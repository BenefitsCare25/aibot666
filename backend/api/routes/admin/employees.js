import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  importEmployeesFromExcel,
  validateExcelFormat,
  generateExcelTemplate
} from '../../services/excel.js';
import {
  addEmployee,
  updateEmployee,
  getEmployeeByEmployeeId,
  deactivateEmployee,
  reactivateEmployee,
  deactivateEmployeesBulk
} from '../../services/vectorDB.js';
import { sanitizeSearchParam } from '../../utils/sanitize.js';
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
 * POST /api/admin/employees/upload
 * Upload and import employees from Excel
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filePath = req.file.path;

    // Validate format first
    const validation = await validateExcelFormat(filePath);

    if (!validation.valid) {
      // Clean up uploaded file
      fs.unlinkSync(filePath);

      return res.status(400).json({
        success: false,
        error: 'Invalid Excel format',
        details: validation.errors
      });
    }

    // Get duplicate handling action from request (skip or update)
    const duplicateAction = req.body.duplicateAction || 'skip';

    // Get sync mode from request (true or false)
    const syncMode = req.body.syncMode === 'true' || req.body.syncMode === true;

    // Import employees with company-specific client
    const result = await importEmployeesFromExcel(filePath, req.supabase, duplicateAction, syncMode);

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
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      deactivated: result.deactivated || 0,
      duplicates: result.duplicates,
      errors: result.errors || [],
      message: result.message
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
      details: safeErrorDetails(error)
    });
  }
});

/**
 * GET /api/admin/employees/template
 * Download Excel template
 */
router.get('/template', async (req, res) => {
  try {
    const buffer = await generateExcelTemplate();

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
router.get('/ids', async (req, res) => {
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
      const safeSearch = sanitizeSearchParam(search);
      if (safeSearch) {
        query = query.or(`name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,employee_id.ilike.%${safeSearch}%,user_id.ilike.%${safeSearch}%`);
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
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit: rawLimit = 50, search = '', status = 'active' } = req.query;
    const limit = Math.min(parseInt(rawLimit) || 50, 200);
    const offset = (page - 1) * limit;

    let query = req.supabase
      .from('employees')
      .select('*', { count: 'exact' });

    // Add status filter
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }
    // 'all' status shows both active and inactive

    // Add search filter if provided
    const safeSearch = sanitizeSearchParam(search);
    if (safeSearch) {
      query = query.or(`name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,employee_id.ilike.%${safeSearch}%,user_id.ilike.%${safeSearch}%`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Get counts for active and inactive employees (without search filter)
    const { count: activeCount, error: activeError } = await req.supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: inactiveCount, error: inactiveError } = await req.supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false);

    if (activeError || inactiveError) {
      console.error('Error fetching employee counts:', activeError || inactiveError);
    }

    res.json({
      success: true,
      data: {
        employees: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        },
        counts: {
          active: activeCount || 0,
          inactive: inactiveCount || 0,
          all: (activeCount || 0) + (inactiveCount || 0)
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
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
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
      details: safeErrorDetails(error)
    });
  }
});

/**
 * PUT /api/admin/employees/:id
 * Update employee by ID with embedding regeneration
 */
router.put('/:id', async (req, res) => {
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
      details: safeErrorDetails(error)
    });
  }
});

/**
 * DELETE /api/admin/employees/:id
 * Delete employee by ID
 */
router.delete('/:id', async (req, res) => {
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
      details: safeErrorDetails(error)
    });
  }
});

/**
 * POST /api/admin/employees/bulk-delete
 * Delete multiple employees by IDs
 */
router.post('/bulk-delete', async (req, res) => {
  try {
    const { employeeIds } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'employeeIds array is required'
      });
    }


    // Delete in batches to avoid URI too long error
    // Supabase .in() uses URL query params, which has size limits
    const batchSize = 50; // Reduced batch size to prevent URI length issues
    let totalDeleted = 0;

    for (let i = 0; i < employeeIds.length; i += batchSize) {
      const batch = employeeIds.slice(i, i + batchSize);


      const { error, count } = await req.supabase
        .from('employees')
        .delete()
        .in('id', batch);

      if (error) {
        console.error(`[Bulk Delete] Error in batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }

      totalDeleted += batch.length;
    }


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
      details: safeErrorDetails(error) || 'Unknown error occurred'
    });
  }
});

/**
 * PATCH /api/admin/employees/:id/deactivate
 * Deactivate an employee (soft delete)
 */
router.patch('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, deactivatedBy } = req.body;


    const employee = await deactivateEmployee(
      id,
      {
        reason: reason || 'No reason provided',
        deactivatedBy: deactivatedBy || 'admin'
      },
      req.supabase
    );

    res.json({
      success: true,
      message: 'Employee deactivated successfully',
      data: employee
    });
  } catch (error) {
    console.error('Error deactivating employee:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to deactivate employee',
      details: safeErrorDetails(error)
    });
  }
});

/**
 * PATCH /api/admin/employees/:id/reactivate
 * Reactivate a previously deactivated employee
 */
router.patch('/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;


    const employee = await reactivateEmployee(id, req.supabase);

    res.json({
      success: true,
      message: 'Employee reactivated successfully',
      data: employee
    });
  } catch (error) {
    console.error('Error reactivating employee:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to reactivate employee',
      details: safeErrorDetails(error)
    });
  }
});

/**
 * POST /api/admin/employees/bulk-deactivate
 * Deactivate multiple employees (bulk soft delete)
 */
router.post('/bulk-deactivate', async (req, res) => {
  try {
    const { employeeIds, reason, deactivatedBy } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'employeeIds array is required'
      });
    }


    const result = await deactivateEmployeesBulk(
      employeeIds,
      {
        reason: reason || 'Bulk deactivation',
        deactivatedBy: deactivatedBy || 'admin'
      },
      req.supabase
    );

    res.json({
      success: true,
      message: `${result.deactivated} employee(s) deactivated successfully`,
      data: result
    });
  } catch (error) {
    console.error('Error bulk deactivating employees:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to bulk deactivate employees',
      details: safeErrorDetails(error)
    });
  }
});

export default router;
