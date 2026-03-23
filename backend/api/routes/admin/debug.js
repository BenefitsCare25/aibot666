import express from 'express';
import supabase from '../../../config/supabase.js';
import { requireSuperAdmin } from '../../middleware/authMiddleware.js';
import { generateEmbedding } from '../../services/openai.js';
import { searchKnowledgeBase } from '../../services/knowledgeService.js';
const router = express.Router();

/**
 * GET /api/admin/debug/company-context
 * Diagnostic endpoint to check company context setup
 */
router.get('/company-context', requireSuperAdmin, async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      headers: {
        'x-widget-domain': req.headers['x-widget-domain'] || 'NOT SET',
        origin: req.headers.origin || 'NOT SET',
        host: req.headers.host || 'NOT SET'
      },
      companyContext: {
        found: !!req.company,
        id: req.company?.id || null,
        name: req.company?.name || null,
        domain: req.company?.domain || null,
        schemaName: req.companySchema || null
      },
      supabaseClient: {
        configured: !!req.supabase,
        schema: req.supabase?._schemaName || 'unknown'
      }
    };

    // Test a simple query to verify schema access
    if (req.supabase) {
      try {
        const { count, error } = await req.supabase
          .from('employees')
          .select('*', { count: 'exact', head: true });

        diagnostics.schemaTest = {
          success: !error,
          employeeCount: count || 0,
          error: error?.message || null
        };
      } catch (queryError) {
        diagnostics.schemaTest = {
          success: false,
          error: queryError.message
        };
      }
    }

    res.json({
      success: true,
      diagnostics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/debug/supabase
 * Diagnostic endpoint to test Supabase connection and schema access
 */
router.get('/supabase', requireSuperAdmin, async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Public schema connection
    try {
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name, domain, schema_name, status')
        .limit(10);

      diagnostics.tests.publicSchema = {
        success: !error,
        companiesFound: companies?.length || 0,
        companies: companies?.map(c => ({ name: c.name, schema: c.schema_name, status: c.status })) || [],
        error: error?.message || null
      };
    } catch (e) {
      diagnostics.tests.publicSchema = { success: false, error: e.message };
    }

    // Test 2: check_schema_exists RPC function
    try {
      const { data: schemaCheck, error } = await supabase
        .rpc('check_schema_exists', { p_schema_name: 'cbre' });

      diagnostics.tests.checkSchemaExistsRPC = {
        success: !error,
        cbreSchemaExists: schemaCheck,
        error: error?.message || null,
        hint: error ? 'Run the migration: backend/migrations/add_check_schema_exists_function.sql' : null
      };
    } catch (e) {
      diagnostics.tests.checkSchemaExistsRPC = {
        success: false,
        error: e.message,
        hint: 'RPC function may not exist. Run: backend/migrations/add_check_schema_exists_function.sql'
      };
    }

    // Test 3: CBRE schema access (if company context available)
    if (req.supabase && req.companySchema) {
      try {
        const { count, error } = await req.supabase
          .from('employees')
          .select('*', { count: 'exact', head: true });

        diagnostics.tests.companySchemaAccess = {
          success: !error,
          schema: req.companySchema,
          employeeCount: count || 0,
          error: error?.message || null
        };
      } catch (e) {
        diagnostics.tests.companySchemaAccess = { success: false, error: e.message };
      }
    } else {
      diagnostics.tests.companySchemaAccess = {
        skipped: true,
        reason: 'No company context available (X-Widget-Domain header missing or company not found)'
      };
    }

    // Test 4: Redis connection
    try {
      const { redis } = await import('../../utils/session.js');
      const pong = await redis.ping();
      diagnostics.tests.redis = {
        success: pong === 'PONG',
        response: pong
      };
    } catch (e) {
      diagnostics.tests.redis = { success: false, error: e.message };
    }

    res.json({
      success: true,
      diagnostics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/debug/test-kb-search
 * Test KB vector search with a real query — generates embedding and searches
 */
router.post('/test-kb-search', requireSuperAdmin, async (req, res) => {
  try {
    const { query, threshold = 0.0, topK = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    if (!req.supabase || !req.companySchema) {
      return res.status(400).json({ success: false, error: 'No company context (check X-Widget-Domain header)' });
    }

    const schema = req.companySchema;

    // Count total KB entries and embeddings
    const { count: totalCount } = await req.supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true });

    const { count: activeCount } = await req.supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // Search with the provided threshold (default 0.0 to see ALL scores)
    const results = await searchKnowledgeBase(query, req.supabase, topK, threshold, null, null, embedding);

    res.json({
      success: true,
      data: {
        schema,
        query,
        threshold,
        totalKBEntries: totalCount,
        activeKBEntries: activeCount,
        resultsFound: results.length,
        results: results.map(r => ({
          id: r.id,
          title: r.title,
          category: r.category,
          subcategory: r.subcategory,
          similarity: r.similarity,
          contentPreview: r.content?.substring(0, 150)
        }))
      }
    });
  } catch (error) {
    console.error('Debug KB search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/debug/re-embed-document
 * Re-generate embeddings for all chunks of a specific document (fixes misaligned embeddings)
 */
router.post('/re-embed-document', requireSuperAdmin, async (req, res) => {
  try {
    const { documentId } = req.body;

    if (!documentId) {
      return res.status(400).json({ success: false, error: 'documentId is required' });
    }

    if (!req.supabase || !req.companySchema) {
      return res.status(400).json({ success: false, error: 'No company context (check X-Widget-Domain header)' });
    }

    const schema = req.companySchema;

    // Fetch all chunks for this document
    const { data: chunks, error: fetchError } = await req.supabase
      .from('knowledge_base')
      .select('id, title, content')
      .eq('document_id', documentId);

    if (fetchError) {
      return res.status(500).json({ success: false, error: `Failed to fetch chunks: ${fetchError.message}` });
    }

    if (!chunks || chunks.length === 0) {
      return res.status(404).json({ success: false, error: 'No chunks found for this document' });
    }

    // Re-generate embeddings in batches
    const { generateEmbeddingsBatch } = await import('../../services/openai.js');
    const BATCH_SIZE = 50;
    let updatedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map(c => c.title ? `${c.title}\n\n${c.content}` : c.content);

      const embeddings = await generateEmbeddingsBatch(texts);

      for (let j = 0; j < batch.length; j++) {
        if (!embeddings[j]) {
          skippedCount++;
          continue;
        }

        const { error: updateError } = await req.supabase
          .from('knowledge_base')
          .update({ embedding: embeddings[j] })
          .eq('id', batch[j].id);

        if (updateError) {
          console.error(`Failed to update chunk ${batch[j].id}:`, updateError.message);
        } else {
          updatedCount++;
        }
      }

      console.log(`Re-embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} chunks`);
    }

    // Invalidate query cache since embeddings changed
    const { invalidateCompanyQueryCache } = await import('../../utils/session.js');
    await invalidateCompanyQueryCache(schema);

    res.json({
      success: true,
      data: {
        schema,
        documentId,
        totalChunks: chunks.length,
        updatedCount,
        skippedCount,
      }
    });
  } catch (error) {
    console.error('Re-embed document error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/debug/re-embed-all
 * Re-generate embeddings for ALL knowledge base entries in the company schema
 */
router.post('/re-embed-all', requireSuperAdmin, async (req, res) => {
  try {
    if (!req.supabase || !req.companySchema) {
      return res.status(400).json({ success: false, error: 'No company context (check X-Widget-Domain header)' });
    }

    const schema = req.companySchema;

    const { data: entries, error: fetchError } = await req.supabase
      .from('knowledge_base')
      .select('id, title, content');

    if (fetchError) {
      return res.status(500).json({ success: false, error: `Failed to fetch entries: ${fetchError.message}` });
    }

    if (!entries || entries.length === 0) {
      return res.status(404).json({ success: false, error: 'No knowledge base entries found' });
    }

    const { generateEmbeddingsBatch } = await import('../../services/openai.js');
    const BATCH_SIZE = 50;
    let updatedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const texts = batch.map(e => e.title ? `${e.title}\n\n${e.content}` : e.content);

      const embeddings = await generateEmbeddingsBatch(texts);

      for (let j = 0; j < batch.length; j++) {
        if (!embeddings[j]) {
          skippedCount++;
          continue;
        }

        const { error: updateError } = await req.supabase
          .from('knowledge_base')
          .update({ embedding: embeddings[j] })
          .eq('id', batch[j].id);

        if (updateError) {
          console.error(`Failed to update entry ${batch[j].id}:`, updateError.message);
        } else {
          updatedCount++;
        }
      }

      console.log(`Re-embedded ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length} entries`);

      if (i + BATCH_SIZE < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const { invalidateCompanyQueryCache } = await import('../../utils/session.js');
    await invalidateCompanyQueryCache(schema);

    res.json({
      success: true,
      data: {
        schema,
        totalEntries: entries.length,
        updatedCount,
        skippedCount,
      }
    });
  } catch (error) {
    console.error('Re-embed all error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
