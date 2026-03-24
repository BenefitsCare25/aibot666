import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { groupQuestionsByCategory } from '../../utils/quickQuestionUtils.js';
import { safeErrorDetails } from '../../utils/response.js';

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
 * GET /api/admin/quick-questions
 * Get all quick questions grouped by category (active only)
 */
router.get('/', async (req, res) => {
  try {
    // Query directly from the schema-specific table
    const { data: questions, error } = await req.supabase
      .from('quick_questions')
      .select('*')
      .eq('is_active', true)
      .order('category_id')
      .order('display_order');

    if (error) {
      console.error('Error fetching quick questions:', error);
      throw error;
    }

    res.json({
      success: true,
      data: groupQuestionsByCategory(questions)
    });
  } catch (error) {
    console.error('Error fetching quick questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quick questions',
      details: safeErrorDetails(error)
    });
  }
});

/**
 * GET /api/admin/quick-questions/all
 * Get all quick questions (admin view with inactive)
 */
router.get('/all', async (req, res) => {
  try {
    // Query directly from the schema-specific table (all questions including inactive)
    const { data: questions, error } = await req.supabase
      .from('quick_questions')
      .select('*')
      .order('category_id')
      .order('display_order');

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
router.post('/', async (req, res) => {
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
      details: safeErrorDetails(error)
    });
  }
});

/**
 * PUT /api/admin/quick-questions/:id
 * Update a quick question
 */
router.put('/:id', async (req, res) => {
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
      details: safeErrorDetails(error)
    });
  }
});

/**
 * DELETE /api/admin/quick-questions/:id
 * Delete a quick question
 */
router.delete('/:id', async (req, res) => {
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
      details: safeErrorDetails(error)
    });
  }
});

/**
 * PUT /api/admin/quick-questions/category/:categoryId
 * Update category name and icon for all questions in a category
 */
router.put('/category/:categoryId', async (req, res) => {
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
      details: safeErrorDetails(error)
    });
  }
});

/**
 * POST /api/admin/quick-questions/bulk-import
 * Bulk import quick questions from JSON
 */
router.post('/bulk-import', async (req, res) => {
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
      details: safeErrorDetails(error)
    });
  }
});

/**
 * POST /api/admin/quick-questions/upload-excel
 * Upload and import quick questions from Excel file
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
    const { importQuickQuestionsFromExcel } = await import('../../services/excelQuickQuestions.js');
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
      details: safeErrorDetails(error)
    });
  }
});

export default router;
