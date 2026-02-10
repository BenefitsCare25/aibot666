import express from 'express';
import supabase from '../../../config/supabase.js';
import { requireSuperAdmin } from '../../middleware/authMiddleware.js';
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

export default router;
