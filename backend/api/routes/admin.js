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
import { getAllCompanies, getCompanyById } from '../services/companySchema.js';
import { companyContextMiddleware, adminContextMiddleware } from '../middleware/companyContext.js';

const router = express.Router();

// Apply company context middleware to routes that need schema-specific data
// Company management routes use adminContextMiddleware (public schema)
router.use('/companies', adminContextMiddleware);

// All other admin routes use companyContextMiddleware (company-specific schema)
router.use((req, res, next) => {
  // Skip middleware for company routes
  if (req.path.startsWith('/companies')) {
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

    let query = req.supabase
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
 * Create new company
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

    res.json({
      success: true,
      data: company
    });
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
 * Delete company
 */
router.delete('/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to delete company'
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
          last_message_at: msg.created_at
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

export default router;
