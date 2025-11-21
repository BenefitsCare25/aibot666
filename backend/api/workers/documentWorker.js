import { Worker } from 'bullmq';
import { processDocument } from '../services/documentProcessor.js';
import { addKnowledgeEntriesBatch } from '../services/vectorDB.js';
import { getSchemaClient } from '../../config/supabase.js';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Parse Redis URL for BullMQ connection
const parseRedisUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 6379,
      password: urlObj.password || undefined,
      username: urlObj.username || undefined,
    };
  } catch (error) {
    console.error('Error parsing Redis URL:', error);
    return {
      host: 'localhost',
      port: 6379
    };
  }
};

const redisConnection = parseRedisUrl(REDIS_URL);

/**
 * Update document upload status in database
 * @param {string} documentId - Document UUID
 * @param {string} status - Status ('queued', 'processing', 'completed', 'failed')
 * @param {Object} updates - Additional fields to update
 * @param {Object} schemaClient - Supabase client for the company schema
 */
async function updateDocumentStatus(documentId, status, updates = {}, schemaClient) {
  try {
    const updateData = {
      status,
      ...updates,
    };

    if (status === 'processing' && !updates.processing_started_at) {
      updateData.processing_started_at = new Date().toISOString();
    }

    if (status === 'completed' && !updates.processing_completed_at) {
      updateData.processing_completed_at = new Date().toISOString();
    }

    const { error } = await schemaClient
      .from('document_uploads')
      .update(updateData)
      .eq('id', documentId);

    if (error) {
      console.error(`Error updating document status to ${status}:`, error);
      throw error;
    }

    console.log(`Document ${documentId} status updated to: ${status}`);
  } catch (error) {
    console.error('Error in updateDocumentStatus:', error);
    throw error;
  }
}

/**
 * Delete all chunks associated with a document (rollback on failure)
 * @param {string} documentId - Document UUID
 * @param {Object} schemaClient - Supabase client
 */
async function deleteDocumentChunks(documentId, schemaClient) {
  try {
    const { error } = await schemaClient
      .from('knowledge_base')
      .delete()
      .eq('document_id', documentId);

    if (error) {
      console.error('Error deleting document chunks:', error);
    } else {
      console.log(`Deleted all chunks for document ${documentId}`);
    }
  } catch (error) {
    console.error('Error in deleteDocumentChunks:', error);
  }
}

/**
 * Store document chunks in knowledge base
 * @param {Array} chunks - Array of chunks with embeddings
 * @param {string} documentId - Document UUID
 * @param {string} category - Document category
 * @param {string} subcategory - Document subcategory
 * @param {Object} schemaClient - Supabase client
 */
async function storeChunks(chunks, documentId, category, subcategory, schemaClient) {
  try {
    // Prepare knowledge base entries
    const entries = chunks.map((chunk, index) => ({
      title: chunk.heading || chunk.title || `Chunk ${index + 1}`,
      content: chunk.content,
      category: category,
      subcategory: subcategory || null,
      metadata: {
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        has_heading: chunk.metadata?.hasHeading || false,
        section_index: chunk.metadata?.sectionIndex,
        sub_chunk_index: chunk.metadata?.subChunkIndex,
        estimated_tokens: chunk.metadata?.estimatedTokens,
        source: 'pdf_upload',
      },
      source: 'pdf_upload',
    }));

    // Note: We don't need to generate embeddings here because addKnowledgeEntriesBatch
    // expects chunks WITHOUT embeddings and generates them internally
    // But our chunks ALREADY have embeddings, so we need to insert directly

    // Prepare entries with embeddings for direct insert
    const entriesWithEmbeddings = chunks.map((chunk, index) => ({
      title: entries[index].title,
      content: entries[index].content,
      category: entries[index].category,
      subcategory: entries[index].subcategory,
      embedding: chunk.embedding, // Already generated embeddings
      metadata: entries[index].metadata,
      source: entries[index].source,
      document_id: documentId, // Link to document_uploads table
    }));

    // Insert in batches to avoid overwhelming the database
    const BATCH_SIZE = 100;
    let insertedCount = 0;

    for (let i = 0; i < entriesWithEmbeddings.length; i += BATCH_SIZE) {
      const batch = entriesWithEmbeddings.slice(i, i + BATCH_SIZE);

      const { data, error } = await schemaClient
        .from('knowledge_base')
        .insert(batch)
        .select();

      if (error) {
        throw new Error(`Failed to insert chunk batch: ${error.message}`);
      }

      insertedCount += batch.length;
      console.log(`Inserted ${insertedCount}/${entriesWithEmbeddings.length} chunks`);
    }

    console.log(`Successfully stored ${insertedCount} chunks for document ${documentId}`);
    return insertedCount;
  } catch (error) {
    console.error('Error storing chunks:', error);
    throw error;
  }
}

/**
 * Document processing job handler
 */
const worker = new Worker(
  'document-processing',
  async (job) => {
    const { documentId, filePath, companySchema, uploadedBy, category: preselectedCategory } = job.data;

    console.log(`\n========================================`);
    console.log(`Processing document ${documentId}`);
    console.log(`File: ${filePath}`);
    console.log(`Schema: ${companySchema}`);
    console.log(`========================================\n`);

    // Get schema-specific Supabase client
    const schemaClient = getSchemaClient(companySchema);

    try {
      // Update status to processing
      await updateDocumentStatus(documentId, 'processing', {}, schemaClient);
      await job.updateProgress(10);

      // Step 1: Process document (extract, chunk, embed, detect category)
      console.log('Step 1: Processing PDF document...');
      const { chunks, metadata } = await processDocument(filePath);
      await job.updateProgress(50);

      const detectedCategory = preselectedCategory || metadata.category;

      console.log(`\nProcessing Summary:`);
      console.log(`- Title: ${metadata.title}`);
      console.log(`- Pages: ${metadata.pageCount}`);
      console.log(`- Chunks: ${chunks.length}`);
      console.log(`- Category: ${detectedCategory}\n`);

      // Step 2: Store chunks in knowledge base
      console.log('Step 2: Storing chunks in knowledge base...');
      const insertedCount = await storeChunks(
        chunks,
        documentId,
        detectedCategory,
        null, // subcategory
        schemaClient
      );
      await job.updateProgress(90);

      // Step 3: Update document record as completed
      await updateDocumentStatus(documentId, 'completed', {
        chunk_count: insertedCount,
        category: detectedCategory,
        page_count: metadata.pageCount,
        metadata: {
          title: metadata.title,
          page_count: metadata.pageCount,
          chunk_count: insertedCount,
          author: metadata.author,
          subject: metadata.subject,
          keywords: metadata.keywords,
          creation_date: metadata.creationDate,
        },
      }, schemaClient);

      // Step 4: Delete uploaded PDF file (cleanup)
      console.log('Step 3: Cleaning up uploaded file...');
      try {
        await fs.unlink(filePath);
        console.log(`Deleted file: ${filePath}`);
      } catch (fileError) {
        console.warn(`Could not delete file ${filePath}:`, fileError.message);
        // Don't fail the job if file deletion fails
      }

      await job.updateProgress(100);

      console.log(`\n✅ Document ${documentId} processed successfully!`);
      console.log(`========================================\n`);

      return {
        success: true,
        documentId,
        chunksCreated: insertedCount,
        category: detectedCategory,
      };

    } catch (error) {
      console.error(`\n❌ Error processing document ${documentId}:`, error);

      // Rollback: Delete any chunks that were created
      console.log('Rolling back: Deleting any created chunks...');
      await deleteDocumentChunks(documentId, schemaClient);

      // Update document status to failed
      await updateDocumentStatus(documentId, 'failed', {
        error_message: error.message,
      }, schemaClient);

      // Clean up uploaded file even on failure
      try {
        await fs.unlink(filePath);
        console.log(`Deleted file: ${filePath}`);
      } catch (fileError) {
        console.warn(`Could not delete file ${filePath}:`, fileError.message);
      }

      console.log(`========================================\n`);

      // Re-throw error so BullMQ knows the job failed
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 documents concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // Per 60 seconds
    },
  }
);

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, error) => {
  console.error(`❌ Job ${job?.id} failed:`, error.message);
});

worker.on('error', (error) => {
  console.error('Worker error:', error);
});

worker.on('stalled', (jobId) => {
  console.warn(`⚠️  Job ${jobId} stalled`);
});

console.log('📄 Document processing worker started');
console.log(`🔄 Concurrency: 5 workers`);
console.log(`⏱️  Rate limit: 10 jobs per minute\n`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...');
  await worker.close();
  process.exit(0);
});

export default worker;
