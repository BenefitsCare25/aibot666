import { Worker } from 'bullmq';
import { processDocument, cleanTitle } from '../services/documentProcessor.js';
import { getSchemaClient } from '../../config/supabase.js';
import { parseRedisUrl } from '../../config/redis.js';
import fs from 'fs/promises';

const redisConnection = parseRedisUrl();

/**
 * Update document upload status in database
 */
async function updateDocumentStatus(documentId, status, updates = {}, schemaClient) {
  try {
    const updateData = { status, ...updates };

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
 */
async function storeChunks(chunks, documentId, category, subcategory, schemaClient) {
  try {
    const entriesWithEmbeddings = chunks.map((chunk, index) => ({
      title: cleanTitle(chunk.heading || chunk.title) || `Chunk ${index + 1}`,
      content: chunk.content,
      category: category,
      subcategory: subcategory || null,
      embedding: chunk.embedding,
      metadata: {
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        has_heading: chunk.metadata?.hasHeading || false,
        section_index: chunk.metadata?.sectionIndex,
        sub_chunk_index: chunk.metadata?.subChunkIndex,
        estimated_tokens: chunk.metadata?.estimatedTokens,
        source: 'document_upload',
      },
      source: 'document_upload',
      document_id: documentId,
    }));

    const BATCH_SIZE = 25;
    let insertedCount = 0;

    for (let i = 0; i < entriesWithEmbeddings.length; i += BATCH_SIZE) {
      const batch = entriesWithEmbeddings.slice(i, i + BATCH_SIZE);

      const { error } = await schemaClient
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

    const schemaClient = getSchemaClient(companySchema);

    // Step-level progress: { percent, step, detail }
    const updateProgress = async (percent, step, detail = '') => {
      await job.updateProgress({ percent, step, detail });
    };

    try {
      await updateDocumentStatus(documentId, 'processing', {}, schemaClient);
      await updateProgress(5, 'extracting', 'Starting content extraction...');

      // Step 1: Process document with step callbacks
      const { chunks, metadata } = await processDocument(
        filePath,
        [],
        (step, detail) => {
          const stepPercents = {
            extracting: 15,
            chunking: 35,
            categorizing: 45,
            embedding: 55,
          };
          const percent = stepPercents[step] || 50;
          updateProgress(percent, step, detail).catch(() => {});
        }
      );

      await updateProgress(70, 'embedding', `Processed ${chunks.length} chunks`);

      const detectedCategory = preselectedCategory || metadata.category;

      console.log(`\nProcessing Summary:`);
      console.log(`- Title: ${metadata.title}`);
      console.log(`- Pages: ${metadata.pageCount}`);
      console.log(`- Chunks: ${chunks.length}`);
      console.log(`- Category: ${detectedCategory}`);
      console.log(`- Method: ${metadata.extractionMethod}\n`);

      // Step 2: Store chunks
      await updateProgress(75, 'storing', 'Saving to knowledge base...');
      const insertedCount = await storeChunks(
        chunks, documentId, detectedCategory, null, schemaClient
      );
      await updateProgress(90, 'storing', `Stored ${insertedCount} chunks`);

      // Step 3: Update document record
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
          extraction_method: metadata.extractionMethod,
        },
      }, schemaClient);

      // Step 4: Cleanup
      await updateProgress(95, 'cleanup', 'Cleaning up...');
      try {
        await fs.unlink(filePath);
      } catch (fileError) {
        console.warn(`Could not delete file ${filePath}:`, fileError.message);
      }

      await updateProgress(100, 'completed', 'Done');

      console.log(`\n✅ Document ${documentId} processed successfully!`);
      console.log(`========================================\n`);

      return {
        success: true,
        documentId,
        chunksCreated: insertedCount,
        category: detectedCategory,
        extractionMethod: metadata.extractionMethod,
      };

    } catch (error) {
      console.error(`\n❌ Error processing document ${documentId}:`, error);

      console.log('Rolling back: Deleting any created chunks...');
      await deleteDocumentChunks(documentId, schemaClient);

      await updateDocumentStatus(documentId, 'failed', {
        error_message: error.message,
      }, schemaClient);

      try {
        await fs.unlink(filePath);
      } catch (fileError) {
        console.warn(`Could not delete file ${filePath}:`, fileError.message);
      }

      console.log(`========================================\n`);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
    lockDuration: 600000,
    stalledInterval: 600000,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
);

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
