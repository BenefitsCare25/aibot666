import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { addDocumentProcessingJob, getJobStatus } from '../services/jobQueue.js';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { getSchemaClient, supabase } from '../../config/supabase.js';
import { getCompanyByDomain, normalizeDomain } from '../services/companySchema.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Middleware to get company schema from selected company
router.use(async (req, res, next) => {
  try {
    // Get selected company from header (set by admin frontend)
    const selectedCompanyDomain = req.headers['x-widget-domain'];

    if (!selectedCompanyDomain) {
      return res.status(400).json({
        success: false,
        error: 'No company selected. Please select a company first.'
      });
    }

    // Look up company from database
    const normalizedDomain = normalizeDomain(selectedCompanyDomain);
    const company = await getCompanyByDomain(normalizedDomain);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: `Company not found for domain: ${selectedCompanyDomain}`
      });
    }

    if (company.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Company account is not active'
      });
    }

    // Get schema-specific client
    req.supabase = getSchemaClient(company.schema_name);
    req.companySchema = company.schema_name;

    next();
  } catch (error) {
    console.error('Error in document route middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to identify company context'
    });
  }
});

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/documents';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Only accept PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

/**
 * POST /api/admin/documents/upload
 * Upload PDF document for knowledge base extraction
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { category } = req.body; // Optional pre-selected category
    const schemaName = req.companySchema;
    const adminUserId = req.user?.id; // From auth middleware

    // Generate document ID
    const documentId = uuidv4();

    // Create document_uploads record
    const documentData = {
      id: documentId,
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_size: req.file.size,
      category: category || null,
      status: 'queued',
      uploaded_by: adminUserId,
    };

    const { error: insertError } = await req.supabase
      .from('document_uploads')
      .insert([documentData]);

    if (insertError) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      throw new Error(`Failed to create document record: ${insertError.message}`);
    }

    // Queue background processing job
    await addDocumentProcessingJob({
      documentId,
      filePath: req.file.path,
      companySchema: schemaName,
      uploadedBy: adminUserId,
      category: category || null,
    });

    console.log(`Document ${documentId} queued for processing`);

    res.json({
      success: true,
      message: 'Document uploaded successfully and queued for processing',
      data: {
        documentId,
        filename: req.file.originalname,
        status: 'queued',
        fileSize: req.file.size,
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(400).json({
      success: false,
      error: 'Failed to upload document',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/documents
 * Get all uploaded documents with optional status filter
 */
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = req.supabase
      .from('document_uploads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/documents/:id/status
 * Get document processing status (for real-time polling)
 */
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    // Get document record from database
    const { data, error } = await req.supabase
      .from('document_uploads')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Get job status from BullMQ (if still queued or processing)
    let jobStatus = null;
    if (data.status === 'queued' || data.status === 'processing') {
      jobStatus = await getJobStatus(id);
    }

    res.json({
      success: true,
      data: {
        id: data.id,
        filename: data.original_name,
        status: data.status,
        category: data.category,
        chunkCount: data.chunk_count,
        pageCount: data.page_count,
        error: data.error_message,
        processingStartedAt: data.processing_started_at,
        processingCompletedAt: data.processing_completed_at,
        createdAt: data.created_at,
        jobProgress: jobStatus?.progress || 0,
      }
    });
  } catch (error) {
    console.error('Error fetching document status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document status',
      details: error.message
    });
  }
});

/**
 * DELETE /api/admin/documents/:id
 * Delete document and all associated knowledge chunks
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get document details first
    const { data: document, error: fetchError } = await req.supabase
      .from('document_uploads')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Delete from database (cascades to knowledge_base chunks via ON DELETE CASCADE)
    const { error: deleteError } = await req.supabase
      .from('document_uploads')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Failed to delete document: ${deleteError.message}`);
    }

    console.log(`Document ${id} deleted (${document.chunk_count} chunks removed)`);

    res.json({
      success: true,
      message: 'Document and associated knowledge chunks deleted successfully',
      data: {
        documentId: id,
        chunksRemoved: document.chunk_count || 0,
      }
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/documents/:id/chunks
 * Get all knowledge chunks associated with a document (for debugging/preview)
 */
router.get('/:id/chunks', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await req.supabase
      .from('knowledge_base')
      .select('id, title, content, category, subcategory, metadata, created_at', { count: 'exact' })
      .eq('document_id', id)
      .order('created_at', { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      throw new Error(`Failed to fetch chunks: ${error.message}`);
    }

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching document chunks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document chunks',
      details: error.message
    });
  }
});

export default router;
