import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  addKnowledgeEntry,
  addKnowledgeEntriesBatch,
  updateKnowledgeEntry,
  deleteKnowledgeEntry
} from '../../services/vectorDB.js';
import { sanitizeSearchParam } from '../../utils/sanitize.js';
import { invalidateCompanyQueryCache } from '../../utils/session.js';

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
 * POST /api/admin/knowledge
 * Add knowledge base entry
 */
router.post('/', async (req, res) => {
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

    invalidateCompanyQueryCache(req.company.schemaName).catch(() => {}); // non-fatal

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
router.post('/batch', async (req, res) => {
  try {
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Entries array is required'
      });
    }

    const created = await addKnowledgeEntriesBatch(entries, req.supabase); // Pass schema-specific client

    invalidateCompanyQueryCache(req.company.schemaName).catch(() => {}); // non-fatal

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
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit: rawKbLimit = 50, category = '', search = '' } = req.query;
    const limit = Math.min(parseInt(rawKbLimit) || 50, 200);
    const offset = (page - 1) * limit;

    let query = req.supabase
      .from('knowledge_base')
      .select('*', { count: 'exact' });

    // Filter by category
    if (category) {
      query = query.eq('category', category);
    }

    // Search filter
    const safeKbSearch = sanitizeSearchParam(search);
    if (safeKbSearch) {
      query = query.or(`title.ilike.%${safeKbSearch}%,content.ilike.%${safeKbSearch}%`);
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
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const entry = await updateKnowledgeEntry(id, updates, req.supabase); // Pass schema-specific client

    invalidateCompanyQueryCache(req.company.schemaName).catch(() => {}); // non-fatal

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
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await deleteKnowledgeEntry(id, req.supabase); // Pass schema-specific client

    invalidateCompanyQueryCache(req.company.schemaName).catch(() => {}); // non-fatal

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
router.post('/upload-excel', upload.single('file'), async (req, res) => {
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
    const { importKnowledgeBaseFromExcel } = await import('../../services/excelKnowledgeBase.js');
    const result = await importKnowledgeBaseFromExcel(
      req.file.path,
      schemaName,
      replace === 'true'
    );

    // Delete uploaded file
    fs.unlinkSync(req.file.path);

    invalidateCompanyQueryCache(req.company.schemaName).catch(() => {}); // non-fatal

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

export default router;
