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
  getEmployeeByEmployeeId
} from '../services/vectorDB.js';
import supabase from '../../config/supabase.js';

const router = express.Router();

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

    // Import employees
    const result = await importEmployeesFromExcel(filePath);

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
 * GET /api/admin/employees
 * Get all employees (with pagination)
 */
router.get('/employees', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('employees')
      .select('*', { count: 'exact' });

    // Add search filter if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%`);
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

    const employee = await getEmployeeByEmployeeId(id);

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

    const employee = await addEmployee(employeeData);

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
    });

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

    const created = await addKnowledgeEntriesBatch(entries);

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

    let query = supabase
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

    const entry = await updateKnowledgeEntry(id, updates);

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

    await deleteKnowledgeEntry(id);

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
 * GET /api/admin/escalations
 * Get escalations (with filters)
 */
router.get('/escalations', async (req, res) => {
  try {
    const { status = '', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
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
 * GET /api/admin/analytics
 * Get usage analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get chat statistics
    let chatQuery = supabase
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
    const { data: escalations, error: escError } = await supabase
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

export default router;
