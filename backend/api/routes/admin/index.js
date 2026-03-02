import express from 'express';
import { companyContextMiddleware, adminContextMiddleware, invalidateCompanyCache } from '../../middleware/companyContext.js';
import { authenticateToken, requireSuperAdmin } from '../../middleware/authMiddleware.js';

// Import sub-routers
import employeesRouter from './employees.js';
import knowledgeRouter from './knowledge.js';
import escalationsRouter from './escalations.js';
import companiesRouter from './companies.js';
import chatHistoryRouter from './chatHistory.js';
import analyticsRouter from './analytics.js';
import quickQuestionsRouter from './quickQuestions.js';
import debugRouter from './debug.js';
import emailAutomationRouter from './emailAutomation.js';

const router = express.Router();

// Protect all admin routes with authentication
router.use(authenticateToken);

// ============================================================
// Routes that don't require company context (BEFORE middleware)
// ============================================================

/**
 * GET /api/admin/db-test
 * Test PostgreSQL connection for diagnostics
 */
router.get('/db-test', requireSuperAdmin, async (req, res) => {
  const { postgres } = await import('../../../config/supabase.js');

  const diagnostics = {
    timestamp: new Date().toISOString(),
    postgres_available: !!postgres,
    connection_string: process.env.SUPABASE_CONNECTION_STRING ? 'SET' : 'NOT SET',
    database_url: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    db_password: process.env.SUPABASE_DB_PASSWORD ? 'SET' : 'NOT SET',
    tests: {}
  };

  if (!postgres) {
    return res.json({
      success: false,
      error: 'PostgreSQL pool not initialized',
      diagnostics
    });
  }

  // Test 1: Simple query
  try {
    const start = Date.now();
    const result = await postgres.query('SELECT NOW() as current_time');
    diagnostics.tests.simple_query = {
      success: true,
      duration_ms: Date.now() - start,
      result: result.rows[0]
    };
  } catch (error) {
    diagnostics.tests.simple_query = {
      success: false,
      error: error.message,
      code: error.code
    };
  }

  // Test 2: Schema listing
  try {
    const start = Date.now();
    const result = await postgres.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);
    diagnostics.tests.list_schemas = {
      success: true,
      duration_ms: Date.now() - start,
      schemas: result.rows.map(r => r.schema_name)
    };
  } catch (error) {
    diagnostics.tests.list_schemas = {
      success: false,
      error: error.message,
      code: error.code
    };
  }

  res.json({
    success: true,
    diagnostics
  });
});

/**
 * GET /api/admin/quick-questions/download-template
 * Download Excel template for quick questions (no company context required)
 */
router.get('/quick-questions/download-template', async (req, res) => {
  try {
    const { generateQuickQuestionsTemplate } = await import('../../services/excelTemplateGenerator.js');
    const buffer = await generateQuickQuestionsTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=QuickQuestions_Template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate template',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/knowledge/download-template
 * Download Excel template for knowledge base (no company context required)
 */
router.get('/knowledge/download-template', async (req, res) => {
  try {
    const { generateKnowledgeBaseTemplate } = await import('../../services/excelTemplateGenerator.js');
    const buffer = await generateKnowledgeBaseTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=KnowledgeBase_Template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate template',
      details: error.message
    });
  }
});

// ============================================================
// Middleware application
// ============================================================

// Company management routes use adminContextMiddleware (public schema)
router.use('/companies', adminContextMiddleware);

// All other admin routes use companyContextMiddleware (company-specific schema)
router.use((req, res, next) => {
  // Skip middleware for company routes and template downloads
  if (req.path.startsWith('/companies') ||
      req.path.startsWith('/email-automation') ||
      req.path === '/quick-questions/download-template' ||
      req.path === '/knowledge/download-template') {
    return next();
  }
  // Apply company context for all other routes
  return companyContextMiddleware(req, res, next);
});

// ============================================================
// Mount sub-routers
// ============================================================

router.use('/employees', employeesRouter);
router.use('/knowledge', knowledgeRouter);
router.use('/escalations', escalationsRouter);
router.use('/companies', companiesRouter);
router.use('/chat-history', chatHistoryRouter);
router.use('/analytics', analyticsRouter);
router.use('/quick-questions', quickQuestionsRouter);
router.use('/debug', debugRouter);
router.use('/email-automation', emailAutomationRouter);

// Cache clear route (mounted at /cache, not under /debug)
/**
 * POST /api/admin/cache/clear-company
 * Clear company cache for a specific domain
 */
router.post('/cache/clear-company', requireSuperAdmin, async (req, res) => {
  try {
    const { domain } = req.body;

    if (domain) {
      // Clear specific domain
      await invalidateCompanyCache(domain);
      res.json({
        success: true,
        message: `Cache cleared for domain: ${domain}`
      });
    } else {
      // Clear all company caches
      const { redis } = await import('../../utils/session.js');
      const keys = await redis.keys('company:domain:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      res.json({
        success: true,
        message: `Cleared ${keys.length} company cache entries`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
