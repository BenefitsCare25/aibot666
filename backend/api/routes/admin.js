import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  importEmployeesFromExcel,
  validateExcelFormat,
  generateExcelTemplate
} from '../services/excel.js';
import {
  addKnowledgeEntry,
  addKnowledgeEntriesBatch,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  addEmployee,
  updateEmployee,
  getEmployeeByEmployeeId
} from '../services/vectorDB.js';
import supabase from '../../config/supabase.js';
import { getAllCompanies, getCompanyById } from '../services/companySchema.js';
import { companyContextMiddleware, adminContextMiddleware, invalidateCompanyCache } from '../middleware/companyContext.js';
import {
  createCompanySchema,
  rollbackCompanyCreation,
  softDeleteCompany
} from '../services/schemaAutomation.js';

const router = express.Router();

// Routes that don't require company context (must be defined BEFORE middleware)
/**
 * GET /api/admin/quick-questions/download-template
 * Download Excel template for quick questions (no auth/company context required)
 */
router.get('/quick-questions/download-template', async (req, res) => {
  try {
    const { generateQuickQuestionsTemplate } = await import('../services/excelTemplateGenerator.js');
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
 * Download Excel template for knowledge base (no auth/company context required)
 */
router.get('/knowledge/download-template', async (req, res) => {
  try {
    const { generateKnowledgeBaseTemplate } = await import('../services/excelTemplateGenerator.js');
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

// Apply company context middleware to routes that need schema-specific data
// Company management routes use adminContextMiddleware (public schema)
router.use('/companies', adminContextMiddleware);

// All other admin routes use companyContextMiddleware (company-specific schema)
router.use((req, res, next) => {
  // Skip middleware for company routes and template downloads
  if (req.path.startsWith('/companies') ||
      req.path === '/quick-questions/download-template' ||
      req.path === '/knowledge/download-template') {
    return next();
  }
  // Apply company context for all other routes
  return companyContextMiddleware(req, res, next);
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /xlsx|xls|csv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) ||
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                     file.mimetype === 'application/vnd.ms-excel';

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * POST /api/admin/employees/upload
 * Upload and import employees from Excel
 */
router.post('/employees/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filePath = req.file.path;

    // Validate format first
    const validation = validateExcelFormat(filePath);

    if (!validation.valid) {
      // Clean up uploaded file
      fs.unlinkSync(filePath);

      return res.status(400).json({
        success: false,
        error: 'Invalid Excel format',
        details: validation.errors
      });
    }

    // Log warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      console.log('[Excel Upload] Warnings:', validation.warnings);
    }

    // Get duplicate handling action from request (skip or update)
    const duplicateAction = req.body.duplicateAction || 'skip';

    // Import employees with company-specific client
    const result = await importEmployeesFromExcel(filePath, req.supabase, duplicateAction);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
        details: result.errors
      });
    }

    res.json({
      success: true,
      data: {
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        duplicates: result.duplicates,
        message: result.message
      }
    });
  } catch (error) {
    console.error('Error uploading employees:', error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: 'Failed to upload employees',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/employees/template
 * Download Excel template
 */
router.get('/employees/template', (req, res) => {
  try {
    const buffer = generateExcelTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=employee_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate template'
    });
  }
});

/**
 * GET /api/admin/employees/ids
 * Get all employee IDs (for bulk operations)
 */
router.get('/employees/ids', async (req, res) => {
  try {
    const { search = '' } = req.query;

    // Fetch all employee IDs in batches to handle large datasets
    let allEmployees = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = req.supabase
        .from('employees')
        .select('id')
        .range(from, from + batchSize - 1);

      // Add search filter if provided
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%,user_id.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      allEmployees = allEmployees.concat(data);

      // If we got less than batchSize, we've reached the end
      if (data.length < batchSize) {
        hasMore = false;
      } else {
        from += batchSize;
      }
    }

    res.json({
      success: true,
      data: {
        employeeIds: allEmployees.map(emp => emp.id),
        count: allEmployees.length
      }
    });
  } catch (error) {
    console.error('Error fetching employee IDs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee IDs'
    });
  }
});

/**
 * GET /api/admin/employees
 * Get all employees (with pagination)
 */
router.get('/employees', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = req.supabase
      .from('employees')
      .select('*', { count: 'exact' });

    // Add search filter if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%,user_id.ilike.%${search}%`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: {
        employees: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees'
    });
  }
});

/**
 * GET /api/admin/employees/:id
 * Get employee by ID
 */
router.get('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await getEmployeeByEmployeeId(id, req.supabase);

    res.json({
      success: true,
      data: employee
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(404).json({
      success: false,
      error: 'Employee not found'
    });
  }
});

/**
 * POST /api/admin/employees
 * Add single employee
 */
router.post('/employees', async (req, res) => {
  try {
    const employeeData = req.body;

    const employee = await addEmployee(employeeData, req.supabase);

    res.json({
      success: true,
      data: employee
    });
  } catch (error) {
    console.error('Error adding employee:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to add employee',
      details: error.message
    });
  }
});

/**
 * PUT /api/admin/employees/:id
 * Update employee by ID with embedding regeneration
 */
router.put('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Use updateEmployee which regenerates embeddings
    const employee = await updateEmployee(id, updateData, req.supabase);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    res.json({
      success: true,
      data: employee
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update employee',
      details: error.message
    });
  }
});

/**
 * DELETE /api/admin/employees/:id
 * Delete employee by ID
 */
router.delete('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await req.supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to delete employee',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/employees/bulk-delete
 * Delete multiple employees by IDs
 */
router.post('/employees/bulk-delete', async (req, res) => {
  try {
    const { employeeIds } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'employeeIds array is required'
      });
    }

    console.log(`[Bulk Delete] Attempting to delete ${employeeIds.length} employee(s)`);

    // Delete in batches to avoid Supabase .in() method limitations
    const batchSize = 500; // Safe batch size for .in() queries
    let totalDeleted = 0;

    for (let i = 0; i < employeeIds.length; i += batchSize) {
      const batch = employeeIds.slice(i, i + batchSize);

      console.log(`[Bulk Delete] Processing batch ${Math.floor(i / batchSize) + 1}, deleting ${batch.length} records`);

      const { error, count } = await req.supabase
        .from('employees')
        .delete()
        .in('id', batch);

      if (error) {
        console.error(`[Bulk Delete] Error in batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }

      totalDeleted += batch.length;
      console.log(`[Bulk Delete] Batch ${Math.floor(i / batchSize) + 1} completed. Total deleted so far: ${totalDeleted}`);
    }

    console.log(`[Bulk Delete] Successfully deleted ${totalDeleted} employee(s)`);

    res.json({
      success: true,
      message: `${totalDeleted} employee(s) deleted successfully`,
      deleted: totalDeleted
    });
  } catch (error) {
    console.error('Error bulk deleting employees:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to bulk delete employees',
      details: error.message || 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/admin/knowledge
 * Add knowledge base entry
 */
router.post('/knowledge', async (req, res) => {
  try {
    const { title, content, category, subcategory, metadata } = req.body;

    if (!content || !category) {
      return res.status(400).json({
        success: false,
        error: 'Content and category are required'
      });
    }

    const entry = await addKnowledgeEntry({
      title,
      content,
      category,
      subcategory,
      metadata,
      source: 'admin_upload'
    }, req.supabase); // Pass schema-specific client

    res.json({
      success: true,
      data: entry
    });
  } catch (error) {
    console.error('Error adding knowledge entry:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to add knowledge entry',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/knowledge/batch
 * Add multiple knowledge base entries
 */
router.post('/knowledge/batch', async (req, res) => {
  try {
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Entries array is required'
      });
    }

    const created = await addKnowledgeEntriesBatch(entries, req.supabase); // Pass schema-specific client

    res.json({
      success: true,
      data: {
        created: created.length,
        entries: created
      }
    });
  } catch (error) {
    console.error('Error adding knowledge entries:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to add knowledge entries',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/knowledge
 * Get knowledge base entries (with pagination)
 */
router.get('/knowledge', async (req, res) => {
  try {
    const { page = 1, limit = 50, category = '', search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = req.supabase
      .from('knowledge_base')
      .select('*', { count: 'exact' });

    // Filter by category
    if (category) {
      query = query.eq('category', category);
    }

    // Search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: {
        entries: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching knowledge entries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge entries'
    });
  }
});

/**
 * PUT /api/admin/knowledge/:id
 * Update knowledge base entry
 */
router.put('/knowledge/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const entry = await updateKnowledgeEntry(id, updates, req.supabase); // Pass schema-specific client

    res.json({
      success: true,
      data: entry
    });
  } catch (error) {
    console.error('Error updating knowledge entry:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update knowledge entry',
      details: error.message
    });
  }
});

/**
 * DELETE /api/admin/knowledge/:id
 * Delete knowledge base entry
 */
router.delete('/knowledge/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await deleteKnowledgeEntry(id, req.supabase); // Pass schema-specific client

    res.json({
      success: true,
      message: 'Knowledge entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting knowledge entry:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to delete knowledge entry'
    });
  }
});

/**
 * POST /api/admin/knowledge/upload-excel
 * Upload and import knowledge base entries from Excel file
 */
router.post('/knowledge/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { replace } = req.body;
    const schemaName = req.companySchema;

    // Import from Excel
    const { importKnowledgeBaseFromExcel } = await import('../services/excelKnowledgeBase.js');
    const result = await importKnowledgeBaseFromExcel(
      req.file.path,
      schemaName,
      replace === 'true'
    );

    // Delete uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Successfully imported ${result.imported} knowledge base entries from ${result.categories.length} categories`,
      data: result
    });
  } catch (error) {
    console.error('Error uploading Excel file:', error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(400).json({
      success: false,
      error: 'Failed to import knowledge base from Excel',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/escalations
 * Get escalations (with filters)
 */
router.get('/escalations', async (req, res) => {
  try {
    const { status = '', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = req.supabase
      .from('escalations')
      .select(`
        *,
        employees (name, email, policy_type)
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: {
        escalations: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching escalations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch escalations'
    });
  }
});

/**
 * PATCH /api/admin/escalations/:id
 * Update escalation status and resolution
 */
router.patch('/escalations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution, resolved_by, add_to_kb = false } = req.body;

    // Build update object
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (status !== undefined) {
      updates.status = status;

      // Auto-set resolved_at when marking as resolved
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
        if (resolved_by) {
          updates.resolved_by = resolved_by;
        }
      }
    }

    if (resolution !== undefined) {
      updates.resolution = resolution;
    }

    // Update the escalation
    const { data: escalation, error: updateError } = await req.supabase
      .from('escalations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // If marking as resolved and add_to_kb is true, add to knowledge base
    if (status === 'resolved' && add_to_kb && resolution) {
      try {
        const kbEntry = await addKnowledgeEntry({
          title: `Escalation: ${escalation.query.substring(0, 100)}`,
          content: resolution,
          category: 'Escalations',
          subcategory: 'Resolved Queries',
          metadata: {
            escalation_id: escalation.id,
            original_query: escalation.query,
            resolved_by: resolved_by || 'admin'
          },
          source: 'escalation_resolution'
        }, req.supabase); // Pass schema-specific client

        // Mark escalation as added to KB
        await req.supabase
          .from('escalations')
          .update({ was_added_to_kb: true })
          .eq('id', id);

        escalation.was_added_to_kb = true;
      } catch (kbError) {
        console.error('Error adding to knowledge base:', kbError);
        // Don't fail the update if KB addition fails
      }
    }

    res.json({
      success: true,
      data: escalation
    });
  } catch (error) {
    console.error('Error updating escalation:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update escalation',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/companies
 * Get all companies
 */
router.get('/companies', async (req, res) => {
  try {
    const companies = await getAllCompanies();

    res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch companies'
    });
  }
});

/**
 * GET /api/admin/companies/:id
 * Get company by ID
 */
router.get('/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyById(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company'
    });
  }
});

/**
 * POST /api/admin/companies
 * Create new company with automatic schema creation
 */
router.post('/companies', async (req, res) => {
  try {
    const { name, domain, additional_domains, schema_name, settings } = req.body;

    if (!name || !domain || !schema_name) {
      return res.status(400).json({
        success: false,
        error: 'Name, domain, and schema_name are required'
      });
    }

    // Step 1: Insert company into registry
    const { data: company, error } = await supabase
      .from('companies')
      .insert({
        name,
        domain,
        additional_domains: additional_domains || [],
        schema_name,
        settings: settings || {},
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    // Step 2: Automatically create database schema
    try {
      const schemaResult = await createCompanySchema({
        schemaName: schema_name,
        companyId: company.id,
        adminUser: req.user?.email || 'admin' // Add admin user tracking if available
      });

      console.log(`[Admin] Schema created successfully for company ${company.name}: ${schemaResult.schemaName}`);

      res.json({
        success: true,
        data: company,
        schema: {
          created: true,
          name: schemaResult.schemaName,
          duration: schemaResult.duration,
          logId: schemaResult.logId
        }
      });
    } catch (schemaError) {
      // Schema creation failed - rollback company creation
      console.error('[Admin] Schema creation failed, rolling back company:', schemaError);

      try {
        await rollbackCompanyCreation(company.id);
        console.log('[Admin] Company rollback completed');
      } catch (rollbackError) {
        console.error('[Admin] Rollback failed:', rollbackError);
        // Return error but note that manual cleanup may be needed
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to create database schema',
        details: schemaError.message,
        company_rolled_back: true,
        note: 'Company registry entry has been removed due to schema creation failure'
      });
    }
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to create company',
      details: error.message
    });
  }
});

/**
 * PUT /api/admin/companies/:id
 * Update company
 */
router.put('/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, additional_domains, settings, status } = req.body;

    // Get old company data first (to invalidate old domain cache)
    const { data: oldCompany } = await supabase
      .from('companies')
      .select('domain, additional_domains')
      .eq('id', id)
      .single();

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (domain !== undefined) updates.domain = domain;
    if (additional_domains !== undefined) updates.additional_domains = additional_domains;
    if (settings !== undefined) updates.settings = settings;
    if (status !== undefined) updates.status = status;

    const { data: company, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache for old domain(s)
    if (oldCompany) {
      await invalidateCompanyCache(oldCompany.domain);
      if (oldCompany.additional_domains) {
        for (const additionalDomain of oldCompany.additional_domains) {
          await invalidateCompanyCache(additionalDomain);
        }
      }
    }

    // Invalidate cache for new domain(s)
    await invalidateCompanyCache(company.domain);
    if (company.additional_domains) {
      for (const additionalDomain of company.additional_domains) {
        await invalidateCompanyCache(additionalDomain);
      }
    }

    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update company',
      details: error.message
    });
  }
});

/**
 * DELETE /api/admin/companies/:id
 * Soft delete company (mark as inactive, preserve schema and data)
 */
router.delete('/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query; // Check if permanent deletion is requested

    // Get company data first (to invalidate cache)
    const { data: companyToDelete } = await supabase
      .from('companies')
      .select('domain, additional_domains')
      .eq('id', id)
      .single();

    if (permanent === 'true') {
      // Hard delete: permanently delete schema and company record
      const { hardDeleteCompany } = await import('../services/schemaAutomation.js');
      const result = await hardDeleteCompany(id, req.user?.email || 'admin');

      // Invalidate cache for deleted company's domains
      if (companyToDelete) {
        await invalidateCompanyCache(companyToDelete.domain);
        if (companyToDelete.additional_domains) {
          for (const additionalDomain of companyToDelete.additional_domains) {
            await invalidateCompanyCache(additionalDomain);
          }
        }
      }

      res.json({
        success: true,
        message: 'Company permanently deleted',
        data: result,
        note: `Schema "${result.schemaName}" and all data have been permanently deleted. This action cannot be undone.`
      });
    } else {
      // Soft delete: preserve schema and data
      const { softDeleteCompany } = await import('../services/schemaAutomation.js');
      const company = await softDeleteCompany(id, req.user?.email || 'admin');

      // Invalidate cache for soft deleted company's domains
      if (companyToDelete) {
        await invalidateCompanyCache(companyToDelete.domain);
        if (companyToDelete.additional_domains) {
          for (const additionalDomain of companyToDelete.additional_domains) {
            await invalidateCompanyCache(additionalDomain);
          }
        }
      }

      res.json({
        success: true,
        message: 'Company deactivated successfully',
        data: company,
        note: 'Company marked as inactive. Database schema and all data preserved.'
      });
    }
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to delete company',
      details: error.message
    });
  }
});

/**
 * PATCH /api/admin/companies/:id/status
 * Update company status (active/inactive/suspended)
 */
router.patch('/companies/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status value
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        details: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Update company status
    const { updateCompany } = await import('../services/companySchema.js');
    const company = await updateCompany(id, { status });

    res.json({
      success: true,
      message: `Company status updated to ${status}`,
      data: company
    });
  } catch (error) {
    console.error('Error updating company status:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update company status',
      details: error.message
    });
  }
});

/**
 * PATCH /api/admin/companies/:id/email-config
 * Update company email configuration for LOG requests
 */
router.patch('/companies/:id/email-config', async (req, res) => {
  try {
    const { id } = req.params;
    const { log_request_email_to, log_request_email_cc, log_request_keywords } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validate TO email format if provided
    if (log_request_email_to !== undefined && log_request_email_to !== null && log_request_email_to.trim() !== '') {
      const emails = log_request_email_to.split(',').map(e => e.trim());

      for (const email of emails) {
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            error: `Invalid TO email format: ${email}`
          });
        }
      }
    }

    // Validate CC email format if provided
    if (log_request_email_cc !== undefined && log_request_email_cc !== null && log_request_email_cc.trim() !== '') {
      const emails = log_request_email_cc.split(',').map(e => e.trim());

      for (const email of emails) {
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            error: `Invalid CC email format: ${email}`
          });
        }
      }
    }

    const updates = {};
    if (log_request_email_to !== undefined) {
      updates.log_request_email_to = log_request_email_to;
    }
    if (log_request_email_cc !== undefined) {
      updates.log_request_email_cc = log_request_email_cc;
    }
    if (log_request_keywords !== undefined) {
      updates.log_request_keywords = log_request_keywords;
    }

    const { data: company, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache for this company
    await invalidateCompanyCache(company.domain);
    if (company.additional_domains) {
      for (const additionalDomain of company.additional_domains) {
        await invalidateCompanyCache(additionalDomain);
      }
    }

    res.json({
      success: true,
      data: company
    });

  } catch (error) {
    console.error('Error updating email configuration:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update email configuration',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/companies/:id/embed-code
 * Get embed code for a company
 */
router.get('/companies/:id/embed-code', async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyById(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Get API URL from environment or construct from request
    const apiUrl = process.env.API_URL || process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

    // Generate embed code snippets
    const embedCodeAutoInit = `<!-- ${company.name} AI Chatbot Widget -->
<script
  src="${apiUrl}/widget.iife.js"
  data-api-url="${apiUrl}"
  data-position="bottom-right"
  data-color="#3b82f6">
</script>
<link rel="stylesheet" href="${apiUrl}/widget.css">`;

    const embedCodeManualInit = `<!-- ${company.name} AI Chatbot Widget -->
<script src="${apiUrl}/widget.iife.js"></script>
<link rel="stylesheet" href="${apiUrl}/widget.css">
<script>
  InsuranceChatWidget.init({
    apiUrl: '${apiUrl}',
    position: 'bottom-right',  // Options: 'bottom-right', 'bottom-left'
    primaryColor: '#3b82f6'    // Customize widget color
  });
</script>`;

    const instructions = `Implementation Instructions:

1. Copy one of the embed code snippets below
2. Paste it just before the closing </body> tag in your HTML
3. The widget will automatically detect your domain (${company.domain}) and route to your company's chatbot
4. Users can start chatting immediately - no additional configuration needed

Customization Options:
- position: 'bottom-right' or 'bottom-left' (where the widget appears)
- primaryColor: Any valid CSS color (e.g., '#3b82f6', 'rgb(59, 130, 246)', 'blue')

Need help? Contact your system administrator.`;

    res.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          domain: company.domain,
          additional_domains: company.additional_domains
        },
        embedCode: {
          autoInit: embedCodeAutoInit,
          manualInit: embedCodeManualInit
        },
        instructions,
        apiUrl
      }
    });
  } catch (error) {
    console.error('Error generating embed code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate embed code'
    });
  }
});

/**
 * GET /api/admin/chat-history
 * Get all chat conversations with metadata
 */
router.get('/chat-history', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', dateFrom, dateTo, escalatedOnly, employeeId } = req.query;
    const offset = (page - 1) * limit;

    // First, get all unique conversation_ids with filters
    let conversationQuery = req.supabase
      .from('chat_history')
      .select('conversation_id, employee_id, created_at, was_escalated', { count: 'exact' });

    // Apply filters
    if (dateFrom) {
      conversationQuery = conversationQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      conversationQuery = conversationQuery.lte('created_at', dateTo);
    }
    if (escalatedOnly === 'true') {
      conversationQuery = conversationQuery.eq('was_escalated', true);
    }
    if (employeeId) {
      conversationQuery = conversationQuery.eq('employee_id', employeeId);
    }
    if (search) {
      conversationQuery = conversationQuery.ilike('content', `%${search}%`);
    }

    const { data: allMessages, error: msgError } = await conversationQuery;
    if (msgError) throw msgError;

    // Group by conversation_id and calculate metadata
    const conversationMap = new Map();
    allMessages.forEach(msg => {
      const convId = msg.conversation_id;
      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, {
          conversation_id: convId,
          employee_id: msg.employee_id,
          message_count: 0,
          has_escalation: false,
          first_message_at: msg.created_at,
          last_message_at: msg.created_at,
          attended_by: msg.attended_by,
          admin_notes: msg.admin_notes,
          attended_at: msg.attended_at
        });
      }
      const conv = conversationMap.get(convId);
      conv.message_count++;
      if (msg.was_escalated) conv.has_escalation = true;
      if (new Date(msg.created_at) < new Date(conv.first_message_at)) {
        conv.first_message_at = msg.created_at;
      }
      if (new Date(msg.created_at) > new Date(conv.last_message_at)) {
        conv.last_message_at = msg.created_at;
      }
      // Update admin attendance info if present
      if (msg.attended_by) {
        conv.attended_by = msg.attended_by;
        conv.admin_notes = msg.admin_notes;
        conv.attended_at = msg.attended_at;
      }
    });

    // Convert to array and sort by last message
    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

    // Paginate
    const total = conversations.length;
    const paginatedConversations = conversations.slice(offset, offset + parseInt(limit));

    // Get employee details for paginated conversations
    const employeeIds = [...new Set(paginatedConversations.map(c => c.employee_id))];
    const { data: employees } = await req.supabase
      .from('employees')
      .select('id, name, email, policy_type')
      .in('id', employeeIds);

    const employeeMap = new Map(employees?.map(e => [e.id, e]) || []);

    // Get last message preview for each conversation
    const conversationIds = paginatedConversations.map(c => c.conversation_id);
    const { data: lastMessages } = await req.supabase
      .from('chat_history')
      .select('conversation_id, content, role, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    const lastMessageMap = new Map();
    lastMessages?.forEach(msg => {
      if (!lastMessageMap.has(msg.conversation_id)) {
        lastMessageMap.set(msg.conversation_id, msg);
      }
    });

    // Combine all data
    const enrichedConversations = paginatedConversations.map(conv => ({
      ...conv,
      employee: employeeMap.get(conv.employee_id) || null,
      last_message: lastMessageMap.get(conv.conversation_id) || null
    }));

    res.json({
      success: true,
      data: {
        conversations: enrichedConversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history'
    });
  }
});

/**
 * GET /api/admin/chat-history/:conversationId/messages
 * Get all messages for a specific conversation
 */
router.get('/chat-history/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Get all messages for this conversation
    const { data: messages, error: msgError } = await req.supabase
      .from('chat_history')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    // Get employee info if available
    let employee = null;
    if (messages.length > 0 && messages[0].employee_id) {
      const { data: empData } = await req.supabase
        .from('employees')
        .select('*')
        .eq('id', messages[0].employee_id)
        .single();
      employee = empData;
    }

    res.json({
      success: true,
      data: {
        conversation_id: conversationId,
        employee,
        messages
      }
    });
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation messages'
    });
  }
});

/**
 * PUT /api/admin/chat-history/:conversationId/attendance
 * Update admin attendance for a conversation
 */
router.put('/chat-history/:conversationId/attendance', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { attendedBy, adminNotes } = req.body;

    // Validate input
    if (!attendedBy || attendedBy.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Admin name (attendedBy) is required'
      });
    }

    // Update all messages in the conversation with admin attendance info
    const { data, error } = await req.supabase
      .from('chat_history')
      .update({
        attended_by: attendedBy.trim(),
        admin_notes: adminNotes?.trim() || null,
        attended_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId)
      .select();

    if (error) {
      console.error('Error updating admin attendance:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      message: 'Admin attendance updated successfully',
      data: {
        conversationId,
        attendedBy: attendedBy.trim(),
        adminNotes: adminNotes?.trim() || null,
        attendedAt: new Date().toISOString(),
        messagesUpdated: data.length
      }
    });
  } catch (error) {
    console.error('Error updating admin attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin attendance'
    });
  }
});

/**
 * GET /api/admin/analytics
 * Get usage analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get chat statistics
    let chatQuery = req.supabase
      .from('chat_history')
      .select('employee_id, created_at, was_escalated, confidence_score, role');

    if (startDate) {
      chatQuery = chatQuery.gte('created_at', startDate);
    }

    if (endDate) {
      chatQuery = chatQuery.lte('created_at', endDate);
    }

    const { data: chatData, error: chatError } = await chatQuery;

    if (chatError) throw chatError;

    // Calculate metrics
    const totalQueries = chatData.length;
    const escalatedQueries = chatData.filter(c => c.was_escalated).length;
    const avgConfidence = chatData.reduce((sum, c) => sum + (c.confidence_score || 0), 0) / totalQueries;

    // Count unique employees
    const uniqueEmployees = new Set(chatData.map(c => c.employee_id).filter(id => id)).size;

    // Count total AI responses (messages where role is 'assistant')
    const totalResponses = chatData.filter(c => c.role === 'assistant').length;

    // Calculate resolution rate (non-escalated queries / total queries)
    const resolutionRate = totalQueries > 0 ? ((totalQueries - escalatedQueries) / totalQueries * 100).toFixed(2) : 0;

    // Get escalation statistics
    const { data: escalations, error: escError } = await req.supabase
      .from('escalations')
      .select('status, created_at, resolved_at');

    if (escError) throw escError;

    const pendingEscalations = escalations.filter(e => e.status === 'pending').length;
    const resolvedEscalations = escalations.filter(e => e.status === 'resolved').length;

    // Calculate average resolution time
    const resolvedWithTime = escalations.filter(e => e.resolved_at && e.created_at);
    const avgResolutionTime = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, e) => {
          const created = new Date(e.created_at);
          const resolved = new Date(e.resolved_at);
          return sum + (resolved - created);
        }, 0) / resolvedWithTime.length
      : 0;

    res.json({
      success: true,
      data: {
        queries: {
          total: totalQueries,
          uniqueEmployees: uniqueEmployees,
          totalResponses: totalResponses,
          escalated: escalatedQueries,
          escalationRate: totalQueries > 0 ? (escalatedQueries / totalQueries * 100).toFixed(2) : 0,
          avgConfidence: avgConfidence.toFixed(2),
          resolutionRate: resolutionRate
        },
        escalations: {
          total: escalations.length,
          pending: pendingEscalations,
          resolved: resolvedEscalations,
          avgResolutionTimeMinutes: (avgResolutionTime / 1000 / 60).toFixed(2)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

/**
 * GET /api/admin/quick-questions
 * Get all quick questions grouped by category
 */
router.get('/quick-questions', async (req, res) => {
  try {
    const schemaName = req.companySchema;
    console.log(`[Supabase] Querying quick_questions in schema: ${schemaName}`);

    // Use RPC function to query across schemas without manual exposure
    const { data: questions, error } = await supabase
      .rpc('get_quick_questions_by_schema', { schema_name: schemaName });

    if (error) {
      console.error('Error fetching quick questions:', error);
      throw error;
    }

    console.log(`[Supabase] Found ${questions?.length || 0} active quick questions`);

    // Group by category
    const categorized = {};
    questions?.forEach(q => {
      if (!categorized[q.category_id]) {
        categorized[q.category_id] = {
          id: q.category_id,
          title: q.category_title,
          icon: q.category_icon,
          questions: []
        };
      }
      categorized[q.category_id].questions.push({
        id: q.id,
        q: q.question,
        a: q.answer,
        display_order: q.display_order
      });
    });

    res.json({
      success: true,
      data: Object.values(categorized)
    });
  } catch (error) {
    console.error('Error fetching quick questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quick questions',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/quick-questions/all
 * Get all quick questions (admin view with inactive)
 */
router.get('/quick-questions/all', async (req, res) => {
  try {
    const schemaName = req.companySchema;
    console.log(`[Supabase] Querying all quick_questions in schema: ${schemaName}`);

    // Use RPC function to query all questions (including inactive)
    const { data: questions, error } = await supabase
      .rpc('get_all_quick_questions_by_schema', { schema_name: schemaName });

    if (error) {
      console.error('Error fetching all quick questions:', error);
      throw error;
    }

    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Error fetching all quick questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quick questions'
    });
  }
});

/**
 * POST /api/admin/quick-questions
 * Create a new quick question
 */
router.post('/quick-questions', async (req, res) => {
  try {
    const { category_id, category_title, category_icon, question, answer, display_order } = req.body;

    // Validate required fields
    if (!category_id || !category_title || !question || !answer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: category_id, category_title, question, answer'
      });
    }

    const { data, error } = await req.supabase
      .from('quick_questions')
      .insert({
        category_id,
        category_title,
        category_icon: category_icon || 'question',
        question,
        answer,
        display_order: display_order || 0
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Quick question created successfully',
      data
    });
  } catch (error) {
    console.error('Error creating quick question:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to create quick question',
      details: error.message
    });
  }
});

/**
 * PUT /api/admin/quick-questions/:id
 * Update a quick question
 */
router.put('/quick-questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, category_title, category_icon, question, answer, display_order, is_active } = req.body;

    const updateData = {};
    if (category_id !== undefined) updateData.category_id = category_id;
    if (category_title !== undefined) updateData.category_title = category_title;
    if (category_icon !== undefined) updateData.category_icon = category_icon;
    if (question !== undefined) updateData.question = question;
    if (answer !== undefined) updateData.answer = answer;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await req.supabase
      .from('quick_questions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Quick question updated successfully',
      data
    });
  } catch (error) {
    console.error('Error updating quick question:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update quick question',
      details: error.message
    });
  }
});

/**
 * DELETE /api/admin/quick-questions/:id
 * Delete a quick question
 */
router.delete('/quick-questions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await req.supabase
      .from('quick_questions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Quick question deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting quick question:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to delete quick question',
      details: error.message
    });
  }
});

/**
 * PUT /api/admin/quick-questions/category/:categoryId
 * Update category name and icon for all questions in a category
 */
router.put('/quick-questions/category/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { category_title, category_icon } = req.body;

    if (!category_title) {
      return res.status(400).json({
        success: false,
        error: 'Category title is required'
      });
    }

    const updateData = {
      category_title,
      updated_at: new Date().toISOString()
    };

    if (category_icon !== undefined) {
      updateData.category_icon = category_icon;
    }

    const { data, error } = await req.supabase
      .from('quick_questions')
      .update(updateData)
      .eq('category_id', categoryId)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: `Successfully updated category for ${data.length} question(s)`,
      data
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update category',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/quick-questions/bulk-import
 * Bulk import quick questions from JSON
 */
router.post('/quick-questions/bulk-import', async (req, res) => {
  try {
    const { questions, replace } = req.body;

    if (!Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        error: 'Questions must be an array'
      });
    }

    // If replace is true, delete existing questions first
    if (replace) {
      await req.supabase.from('quick_questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // Insert new questions
    const { data, error } = await req.supabase
      .from('quick_questions')
      .insert(questions)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: `Successfully imported ${data.length} quick questions`,
      data
    });
  } catch (error) {
    console.error('Error bulk importing quick questions:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to bulk import quick questions',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/quick-questions/upload-excel
 * Upload and import quick questions from Excel file
 */
router.post('/quick-questions/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { replace } = req.body;
    const schemaName = req.companySchema;

    // Import from Excel
    const { importQuickQuestionsFromExcel } = await import('../services/excelQuickQuestions.js');
    const result = await importQuickQuestionsFromExcel(
      req.file.path,
      schemaName,
      replace === 'true'
    );

    // Delete uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Successfully imported ${result.imported} questions from ${result.categories.length} categories`,
      data: result
    });
  } catch (error) {
    console.error('Error uploading Excel file:', error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(400).json({
      success: false,
      error: 'Failed to import quick questions from Excel',
      details: error.message
    });
  }
});

export default router;
