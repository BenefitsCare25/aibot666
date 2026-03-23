import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { addDocumentProcessingJob, getJobStatus } from '../services/jobQueue.js';
import { generateFileHash, SUPPORTED_FORMATS } from '../services/documentProcessor.js';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { getSchemaClient, supabase } from '../../config/supabase.js';
import { getCompanyByDomain, normalizeDomain } from '../services/companySchema.js';

const router = express.Router();

router.use(authenticateToken);

// Middleware to get company schema from selected company
router.use(async (req, res, next) => {
  try {
    const selectedCompanyDomain = req.headers['x-widget-domain'];

    if (!selectedCompanyDomain) {
      return res.status(400).json({
        success: false,
        error: 'No company selected. Please select a company first.'
      });
    }

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

// Accepted MIME types for document upload
const ACCEPTED_MIME_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/csv': '.csv',
};

// Configure multer for document uploads (multi-format)
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
    fileSize: 25 * 1024 * 1024, // 25MB
  },
  fileFilter: (req, file, cb) => {
    if (ACCEPTED_MIME_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Accepted: PDF, DOCX, TXT, CSV`), false);
    }
  }
});

/**
 * POST /api/admin/documents/upload
 * Upload single document for knowledge base extraction
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Validate magic bytes for PDF and DOCX (skip for plain text/CSV)
    const needsMagicByteCheck = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (needsMagicByteCheck.includes(req.file.mimetype)) {
      const { validateFileMagicBytes } = await import('../utils/fileValidation.js');
      const validation = await validateFileMagicBytes(req.file.path, req.file.mimetype);
      if (!validation.valid) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: validation.reason || 'Invalid file type' });
      }
    }

    const { category } = req.body;
    const schemaName = req.companySchema;
    const adminUserId = req.user?.id;

    // Duplicate detection via file hash
    const fileHash = await generateFileHash(req.file.path);

    const { data: existing } = await req.supabase
      .from('document_uploads')
      .select('id, original_name, status')
      .eq('file_hash', fileHash)
      .limit(1);

    if (existing && existing.length > 0) {
      const dup = existing[0];
      fs.unlinkSync(req.file.path);
      return res.status(409).json({
        success: false,
        error: `Duplicate document detected: "${dup.original_name}" (${dup.status})`,
        data: { duplicateOf: dup.id, filename: dup.original_name }
      });
    }

    const documentId = uuidv4();

    const documentData = {
      id: documentId,
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_size: req.file.size,
      file_hash: fileHash,
      category: category || null,
      status: 'queued',
      uploaded_by: adminUserId,
    };

    const { error: insertError } = await req.supabase
      .from('document_uploads')
      .insert([documentData]);

    if (insertError) {
      fs.unlinkSync(req.file.path);
      throw new Error(`Failed to create document record: ${insertError.message}`);
    }

    await addDocumentProcessingJob({
      documentId,
      filePath: req.file.path,
      companySchema: schemaName,
      uploadedBy: adminUserId,
      category: category || null,
    });

    console.log(`Document ${documentId} queued for processing (${req.file.mimetype})`);

    res.json({
      success: true,
      message: 'Document uploaded and queued for processing',
      data: {
        documentId,
        filename: req.file.originalname,
        status: 'queued',
        fileSize: req.file.size,
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
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
 * POST /api/admin/documents/upload-bulk
 * Upload multiple documents at once (max 10)
 */
router.post('/upload-bulk', upload.array('files', 10), async (req, res) => {
  const results = [];
  const cleanupFiles = [];

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const { category } = req.body;
    const schemaName = req.companySchema;
    const adminUserId = req.user?.id;

    for (const file of req.files) {
      cleanupFiles.push(file.path);

      try {
        // Validate magic bytes for binary formats
        const needsMagicByteCheck = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (needsMagicByteCheck.includes(file.mimetype)) {
          const { validateFileMagicBytes } = await import('../utils/fileValidation.js');
          const validation = await validateFileMagicBytes(file.path, file.mimetype);
          if (!validation.valid) {
            results.push({ filename: file.originalname, success: false, error: validation.reason });
            continue;
          }
        }

        // Duplicate check
        const fileHash = await generateFileHash(file.path);
        const { data: existing } = await req.supabase
          .from('document_uploads')
          .select('id, original_name')
          .eq('file_hash', fileHash)
          .limit(1);

        if (existing && existing.length > 0) {
          results.push({
            filename: file.originalname,
            success: false,
            error: `Duplicate of "${existing[0].original_name}"`,
          });
          continue;
        }

        const documentId = uuidv4();

        const { error: insertError } = await req.supabase
          .from('document_uploads')
          .insert([{
            id: documentId,
            filename: file.filename,
            original_name: file.originalname,
            file_size: file.size,
            file_hash: fileHash,
            category: category || null,
            status: 'queued',
            uploaded_by: adminUserId,
          }]);

        if (insertError) {
          results.push({ filename: file.originalname, success: false, error: insertError.message });
          continue;
        }

        await addDocumentProcessingJob({
          documentId,
          filePath: file.path,
          companySchema: schemaName,
          uploadedBy: adminUserId,
          category: category || null,
        });

        // Remove from cleanup list since worker will handle it
        const idx = cleanupFiles.indexOf(file.path);
        if (idx > -1) cleanupFiles.splice(idx, 1);

        results.push({
          filename: file.originalname,
          success: true,
          documentId,
          status: 'queued',
        });
      } catch (fileError) {
        results.push({ filename: file.originalname, success: false, error: fileError.message });
      }
    }

    // Clean up failed files
    for (const filePath of cleanupFiles) {
      try { fs.unlinkSync(filePath); } catch {}
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `${succeeded} of ${req.files.length} documents queued${failed > 0 ? `, ${failed} failed` : ''}`,
      data: results,
    });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    for (const filePath of cleanupFiles) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    res.status(500).json({ success: false, error: 'Bulk upload failed', details: error.message });
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

    if (error) throw new Error(`Failed to fetch documents: ${error.message}`);

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
    res.status(500).json({ success: false, error: 'Failed to fetch documents', details: error.message });
  }
});

/**
 * GET /api/admin/documents/:id/status
 * Get document processing status with step-level detail
 */
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await req.supabase
      .from('document_uploads')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    let jobStatus = null;
    if (data.status === 'queued' || data.status === 'processing') {
      jobStatus = await getJobStatus(id);
    }

    // Extract step info from progress (now an object)
    const progress = jobStatus?.progress || {};
    const stepInfo = typeof progress === 'object'
      ? { percent: progress.percent || 0, step: progress.step || '', detail: progress.detail || '' }
      : { percent: progress, step: '', detail: '' };

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
        extractionMethod: data.metadata?.extraction_method || null,
        jobProgress: stepInfo.percent,
        jobStep: stepInfo.step,
        jobDetail: stepInfo.detail,
      }
    });
  } catch (error) {
    console.error('Error fetching document status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch document status', details: error.message });
  }
});

/**
 * PATCH /api/admin/documents/:id/metadata
 * Update document category/subcategory after upload
 */
router.patch('/:id/metadata', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, subcategory } = req.body;

    if (!category && subcategory === undefined) {
      return res.status(400).json({ success: false, error: 'Provide category or subcategory to update' });
    }

    // Get document
    const { data: doc, error: fetchError } = await req.supabase
      .from('document_uploads')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    if (doc.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Can only edit metadata of completed documents' });
    }

    // Update document record
    const docUpdate = {};
    if (category) docUpdate.category = category;

    if (Object.keys(docUpdate).length > 0) {
      const { error: updateError } = await req.supabase
        .from('document_uploads')
        .update(docUpdate)
        .eq('id', id);

      if (updateError) throw new Error(`Failed to update document: ${updateError.message}`);
    }

    // Update all associated knowledge chunks
    const chunkUpdate = {};
    if (category) chunkUpdate.category = category;
    if (subcategory !== undefined) chunkUpdate.subcategory = subcategory || null;

    if (Object.keys(chunkUpdate).length > 0) {
      const { error: chunkError } = await req.supabase
        .from('knowledge_base')
        .update(chunkUpdate)
        .eq('document_id', id);

      if (chunkError) throw new Error(`Failed to update chunks: ${chunkError.message}`);
    }

    res.json({
      success: true,
      message: 'Document metadata updated',
      data: { id, ...docUpdate, subcategory: subcategory !== undefined ? subcategory : undefined },
    });
  } catch (error) {
    console.error('Error updating document metadata:', error);
    res.status(500).json({ success: false, error: 'Failed to update metadata', details: error.message });
  }
});

/**
 * DELETE /api/admin/documents/:id
 * Delete document and all associated knowledge chunks
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: document, error: fetchError } = await req.supabase
      .from('document_uploads')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const { error: deleteError } = await req.supabase
      .from('document_uploads')
      .delete()
      .eq('id', id);

    if (deleteError) throw new Error(`Failed to delete document: ${deleteError.message}`);

    console.log(`Document ${id} deleted (${document.chunk_count} chunks removed)`);

    res.json({
      success: true,
      message: 'Document and associated knowledge chunks deleted successfully',
      data: { documentId: id, chunksRemoved: document.chunk_count || 0 }
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, error: 'Failed to delete document', details: error.message });
  }
});

/**
 * GET /api/admin/documents/:id/chunks
 * Get knowledge chunks associated with a document
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

    if (error) throw new Error(`Failed to fetch chunks: ${error.message}`);

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
    res.status(500).json({ success: false, error: 'Failed to fetch document chunks', details: error.message });
  }
});

export default router;
