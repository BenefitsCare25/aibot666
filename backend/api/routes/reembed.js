/**
 * Re-embedding API endpoint
 * Allows triggering re-embedding of knowledge base entries via HTTP request
 */

import express from 'express';
import { generateEmbeddingsBatch } from '../services/openai.js';

const router = express.Router();

/**
 * POST /api/reembed/:schema
 * Re-embed all knowledge base entries for a specific schema
 */
router.post('/:schema', async (req, res) => {
  const { schema } = req.params;
  const BATCH_SIZE = 50;

  try {
    console.log(`[Re-embed] Starting re-embedding for schema: ${schema}`);

    // Get company-specific Supabase client
    const supabaseClient = req.supabase;

    if (!supabaseClient) {
      return res.status(500).json({
        success: false,
        error: 'Database client not available'
      });
    }

    // Fetch all active knowledge base entries
    const { data: entries, error: fetchError } = await supabaseClient
      .from('knowledge_base')
      .select('id, title, content')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch entries: ${fetchError.message}`);
    }

    if (!entries || entries.length === 0) {
      return res.json({
        success: true,
        message: 'No knowledge base entries found',
        processed: 0,
        updated: 0
      });
    }

    console.log(`[Re-embed] Found ${entries.length} entries to process`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(entries.length / BATCH_SIZE);

      console.log(`[Re-embed] Processing batch ${batchNum}/${totalBatches} (${batch.length} entries)`);

      try {
        // Generate embeddings for title + content
        const embeddingTexts = batch.map(entry =>
          entry.title ? `${entry.title}\n\n${entry.content}` : entry.content
        );

        const embeddings = await generateEmbeddingsBatch(embeddingTexts);

        // Update each entry in database
        for (let j = 0; j < batch.length; j++) {
          const entry = batch[j];
          const embedding = embeddings[j];

          try {
            const { error: updateError } = await supabaseClient
              .from('knowledge_base')
              .update({
                embedding: embedding,
                updated_at: new Date().toISOString()
              })
              .eq('id', entry.id);

            if (updateError) {
              console.error(`[Re-embed] Error updating entry ${entry.id}:`, updateError);
              errors++;
            } else {
              updated++;
            }
          } catch (err) {
            console.error(`[Re-embed] Error updating entry ${entry.id}:`, err);
            errors++;
          }
        }

        processed += batch.length;
        console.log(`[Re-embed] Processed ${processed}/${entries.length} entries`);

        // Rate limiting: wait 1 second between batches
        if (i + BATCH_SIZE < entries.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (batchError) {
        console.error(`[Re-embed] Error processing batch ${batchNum}:`, batchError);
        errors += batch.length;
        processed += batch.length;
      }
    }

    console.log(`[Re-embed] Completed: ${updated} updated, ${errors} errors`);

    return res.json({
      success: true,
      message: 'Re-embedding completed',
      schema: schema,
      processed: processed,
      updated: updated,
      errors: errors
    });

  } catch (error) {
    console.error('[Re-embed] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reembed/:schema/status
 * Check status of knowledge base embeddings
 */
router.get('/:schema/status', async (req, res) => {
  try {
    const supabaseClient = req.supabase;

    const { data, error } = await supabaseClient
      .from('knowledge_base')
      .select('id, title, embedding')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to check status: ${error.message}`);
    }

    const total = data.length;
    const withEmbedding = data.filter(e => e.embedding).length;
    const withoutEmbedding = total - withEmbedding;

    return res.json({
      success: true,
      total: total,
      withEmbedding: withEmbedding,
      withoutEmbedding: withoutEmbedding,
      percentage: total > 0 ? Math.round((withEmbedding / total) * 100) : 0
    });

  } catch (error) {
    console.error('[Re-embed Status] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
