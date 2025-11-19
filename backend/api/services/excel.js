import XLSX from 'xlsx';
import { addEmployeesBatch, updateEmployee, updateEmployeesBatch } from './vectorDB.js';
import fs from 'fs';

/**
 * Parse Excel file and extract employee data
 * @param {string} filePath - Path to Excel file
 * @returns {Promise<Array>} - Array of employee objects
 */
export async function parseEmployeeExcel(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    if (!rawData || rawData.length === 0) {
      throw new Error('No data found in Excel file');
    }

    // Map Excel columns to database schema
    const employees = rawData.map((row, index) => {
      try {
        return mapEmployeeData(row);
      } catch (error) {
        console.error(`Error parsing row ${index + 2}:`, error.message);
        throw new Error(`Invalid data in row ${index + 2}: ${error.message}`);
      }
    });

    return employees;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw error;
  }
}

/**
 * Map Excel row to employee database schema
 * @param {Object} row - Excel row data
 * @returns {Object} - Mapped employee object
 */
function mapEmployeeData(row) {
  // Common Excel column variations
  const getField = (row, variations) => {
    for (const key of variations) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    return null;
  };

  const employeeId = getField(row, [
    'employee_id', 'Employee ID', 'EmployeeID', 'EmpID', 'ID'
  ]);

  const userId = getField(row, [
    'user_id', 'User ID', 'UserID', 'UserId'
  ]);

  const name = getField(row, [
    'name', 'Name', 'Full Name', 'FullName', 'Employee Name', 'EmployeeName'
  ]);

  const email = getField(row, [
    'email', 'Email', 'Email Address', 'EmailAddress'
  ]);

  // Validate required fields
  if (!employeeId) {
    throw new Error('Employee ID is required');
  }

  if (!name) {
    throw new Error('Employee name is required');
  }

  if (!email) {
    throw new Error('Email is required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  return {
    employee_id: String(employeeId).trim(),
    user_id: userId ? String(userId).trim() : null,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    metadata: {}
  };
}

/**
 * Parse Excel date to ISO format
 * @param {*} dateValue - Excel date value
 * @returns {string|null} - ISO date string or null
 */
function parseExcelDate(dateValue) {
  if (!dateValue) return null;

  try {
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0];
    }

    // If it's an Excel serial number
    if (typeof dateValue === 'number') {
      const date = XLSX.SSF.parse_date_code(dateValue);
      return new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
    }

    // If it's a string, try to parse it
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    return null;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

/**
 * Import employees from Excel file to database
 * @param {string} filePath - Path to Excel file
 * @param {Object} supabaseClient - Company-specific Supabase client
 * @param {string} duplicateAction - How to handle duplicates: 'skip' or 'update' (default: 'skip')
 * @returns {Promise<Object>} - Import results
 */
export async function importEmployeesFromExcel(filePath, supabaseClient, duplicateAction = 'skip', syncMode = false) {
  try {
    console.log('Parsing Excel file...');
    const employees = await parseEmployeeExcel(filePath);

    console.log(`Found ${employees.length} employees in Excel file`);

    if (employees.length === 0) {
      return {
        success: true,
        imported: 0,
        updated: 0,
        skipped: 0,
        duplicates: [],
        errors: [],
        message: 'No employees to import'
      };
    }

    // Check for existing employees
    console.log('Checking for duplicate employee IDs...');
    const employeeIds = employees.map(e => e.employee_id);

    // Batch the duplicate check to avoid URL length limits (max 500 IDs per batch)
    const BATCH_SIZE = 500;
    let existingEmployees = [];

    for (let i = 0; i < employeeIds.length; i += BATCH_SIZE) {
      const batch = employeeIds.slice(i, i + BATCH_SIZE);
      console.log(`Checking batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(employeeIds.length / BATCH_SIZE)} (${batch.length} IDs)`);

      const { data, error: checkError } = await supabaseClient
        .from('employees')
        .select('employee_id, name, email')
        .in('employee_id', batch);

      if (checkError) {
        throw new Error(`Failed to check for duplicates in batch: ${checkError.message}`);
      }

      if (data) {
        existingEmployees = existingEmployees.concat(data);
      }
    }

    const existingIds = new Set(existingEmployees.map(e => e.employee_id));
    const duplicates = employees.filter(e => existingIds.has(e.employee_id));
    const newEmployees = employees.filter(e => !existingIds.has(e.employee_id));

    console.log(`Found ${duplicates.length} duplicates, ${newEmployees.length} new employees`);

    let imported = [];
    let updated = [];
    let skipped = [];
    let validationErrors = [];

    // Handle new employees in batches to avoid payload size limits
    if (newEmployees.length > 0) {
      console.log(`Importing ${newEmployees.length} new employees in batches...`);
      const INSERT_BATCH_SIZE = 100; // Smaller batches for inserts due to embedding generation

      for (let i = 0; i < newEmployees.length; i += INSERT_BATCH_SIZE) {
        const batch = newEmployees.slice(i, i + INSERT_BATCH_SIZE);
        console.log(`Importing batch ${Math.floor(i / INSERT_BATCH_SIZE) + 1}/${Math.ceil(newEmployees.length / INSERT_BATCH_SIZE)} (${batch.length} employees)`);

        try {
          const batchImported = await addEmployeesBatch(batch, supabaseClient);
          imported = imported.concat(batchImported);
        } catch (error) {
          console.error(`Error importing batch ${Math.floor(i / INSERT_BATCH_SIZE) + 1}:`, error);
          throw error;
        }
      }
    }

    // Handle duplicates based on action
    if (duplicates.length > 0) {
      if (duplicateAction === 'update') {
        console.log(`Updating ${duplicates.length} existing employees with embedding regeneration...`);

        // First, get the existing employee records to get their UUIDs
        // IMPORTANT: Batch this query to avoid URL length limits (same as duplicate check)
        const duplicateEmployeeIds = duplicates.map(e => e.employee_id);
        let existingRecords = [];

        for (let i = 0; i < duplicateEmployeeIds.length; i += BATCH_SIZE) {
          const batch = duplicateEmployeeIds.slice(i, i + BATCH_SIZE);
          console.log(`Fetching UUIDs for batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(duplicateEmployeeIds.length / BATCH_SIZE)} (${batch.length} IDs)`);

          const { data, error: uuidError } = await supabaseClient
            .from('employees')
            .select('id, employee_id')
            .in('employee_id', batch);

          if (uuidError) {
            console.error(`Failed to fetch UUIDs for batch: ${uuidError.message}`);
            throw new Error(`Failed to fetch employee UUIDs: ${uuidError.message}`);
          }

          if (data) {
            existingRecords = existingRecords.concat(data);
          }
        }

        console.log(`Retrieved ${existingRecords.length} UUIDs for ${duplicateEmployeeIds.length} duplicate employee IDs`);

        // Create a map of employee_id to UUID
        const idMap = new Map(existingRecords?.map(e => [e.employee_id, e.id]) || []);

        // Prepare batch update data
        const employeesToUpdate = [];

        for (const emp of duplicates) {
          const employeeUUID = idMap.get(emp.employee_id);

          if (!employeeUUID) {
            const errorMsg = `Could not find UUID for employee ${emp.employee_id} (${emp.name})`;
            console.error(errorMsg);
            validationErrors.push({
              employee_id: emp.employee_id,
              name: emp.name,
              email: emp.email,
              error: 'Employee ID exists in file but not found in database'
            });
            continue;
          }

          employeesToUpdate.push({
            id: employeeUUID,
            updateData: {
              name: emp.name,
              email: emp.email,
              updated_at: new Date().toISOString()
            }
          });
        }

        // Use batch update for better performance
        if (employeesToUpdate.length > 0) {
          try {
            updated = await updateEmployeesBatch(employeesToUpdate, supabaseClient);
            console.log(`✅ Successfully updated ${updated.length} employees with regenerated embeddings`);
          } catch (updateError) {
            console.error('Batch update error:', updateError);
            // Fall back to individual updates if batch fails
            console.log('Falling back to individual updates...');
            for (const { id, updateData } of employeesToUpdate) {
              try {
                const updatedEmployee = await updateEmployee(id, updateData, supabaseClient);
                updated.push(updatedEmployee);
              } catch (individualError) {
                const emp = duplicates.find(e => idMap.get(e.employee_id) === id);
                validationErrors.push({
                  employee_id: emp?.employee_id || 'unknown',
                  name: emp?.name || 'unknown',
                  email: emp?.email || 'unknown',
                  error: individualError.message || 'Update failed'
                });
              }
            }
          }
        }

        if (validationErrors.length > 0) {
          console.warn(`⚠️ ${validationErrors.length} employees failed to update`);
        }
      } else {
        console.log(`Skipping ${duplicates.length} duplicate employees`);
        skipped = duplicates;
      }
    }

    const totalProcessed = imported.length + updated.length + skipped.length;
    const duplicateInfo = duplicates.map(e => ({
      employee_id: e.employee_id,
      name: e.name,
      email: e.email
    }));

    // Handle sync mode: deactivate employees not in Excel file
    let deactivated = 0;
    if (syncMode) {
      console.log('Sync mode enabled: checking for employees to deactivate...');

      const excelEmployeeIds = employees.map(e => e.employee_id);

      // Get all active employees
      const { data: allActiveEmployees, error: activeError } = await supabaseClient
        .from('employees')
        .select('id, employee_id, name')
        .eq('is_active', true);

      if (activeError) {
        console.error('Failed to fetch active employees for sync:', activeError.message);
      } else {
        // Find employees not in Excel file
        const employeesToDeactivate = allActiveEmployees.filter(
          emp => !excelEmployeeIds.includes(emp.employee_id)
        );

        if (employeesToDeactivate.length > 0) {
          console.log(`Found ${employeesToDeactivate.length} employees to deactivate`);

          // Import deactivateEmployeesBulk
          const { deactivateEmployeesBulk } = await import('./vectorDB.js');

          const employeeIdsToDeactivate = employeesToDeactivate.map(e => e.id);

          // Deactivate in batches of 100
          const DEACTIVATE_BATCH_SIZE = 100;
          for (let i = 0; i < employeeIdsToDeactivate.length; i += DEACTIVATE_BATCH_SIZE) {
            const batch = employeeIdsToDeactivate.slice(i, i + DEACTIVATE_BATCH_SIZE);

            try {
              const result = await deactivateEmployeesBulk(
                batch,
                {
                  reason: 'Not in uploaded Excel file (sync mode)',
                  deactivatedBy: 'system'
                },
                supabaseClient
              );
              deactivated += result.deactivated;
            } catch (deactivateError) {
              console.error('Error deactivating batch:', deactivateError.message);
            }
          }

          console.log(`Deactivated ${deactivated} employees (sync mode)`);
        } else {
          console.log('No employees to deactivate');
        }
      }
    }

    return {
      success: true,
      imported: imported.length,
      updated: updated.length,
      skipped: skipped.length,
      deactivated: deactivated,
      duplicates: duplicateInfo,
      errors: validationErrors,
      message: syncMode
        ? `Processed ${totalProcessed} employees: ${imported.length} imported, ${updated.length} updated, ${skipped.length} skipped, ${deactivated} deactivated${validationErrors.length > 0 ? `, ${validationErrors.length} errors` : ''}`
        : `Processed ${totalProcessed} employees: ${imported.length} imported, ${updated.length} updated, ${skipped.length} skipped${validationErrors.length > 0 ? `, ${validationErrors.length} errors` : ''}`
    };
  } catch (error) {
    console.error('Error importing employees:', error);
    return {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      duplicates: [],
      errors: [error.message],
      message: 'Import failed'
    };
  }
}

/**
 * Validate Excel file format
 * @param {string} filePath - Path to Excel file
 * @returns {Object} - Validation results
 */
export function validateExcelFormat(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length === 0) {
      return {
        valid: false,
        errors: ['File is empty']
      };
    }

    const headers = data[0];
    const requiredFields = ['employee_id', 'name', 'email'];
    const errors = [];
    const warnings = [];

    // Check for required columns (case-insensitive and flexible matching)
    // Normalize headers by removing spaces, underscores, and hyphens
    const headerLower = headers.map(h =>
      String(h).toLowerCase().replace(/[\s_-]+/g, '')
    );

    console.log('Excel validation - Original headers:', headers);
    console.log('Excel validation - Normalized headers:', headerLower);

    requiredFields.forEach(field => {
      // Normalize the required field name for comparison
      const normalizedField = field.replace(/[_-]/g, '');

      // Check if any header matches (exact match or contains the field)
      const found = headerLower.some(h => h === normalizedField || h.includes(normalizedField));

      if (!found) {
        const variations = [
          field,
          field.replace(/_/g, ' '),
          field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          field.replace(/_/g, '')
        ];
        errors.push(`Missing required column: "${field}". Expected one of: ${variations.join(', ')}`);
      }
    });

    // Check for recommended optional fields
    const optionalFields = ['policy_type', 'user_id', 'department', 'coverage_limit', 'annual_claim_limit'];
    const missingOptional = [];

    optionalFields.forEach(field => {
      const normalizedField = field.replace(/[_-]/g, '');
      const found = headerLower.some(h => h === normalizedField || h.includes(normalizedField));
      if (!found) {
        missingOptional.push(field);
      }
    });

    if (missingOptional.length > 0) {
      warnings.push(`Optional columns not found (will use default values): ${missingOptional.join(', ')}. ${missingOptional.includes('policy_type') ? 'Policy type will default to "Standard".' : ''}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      rowCount: data.length - 1, // Exclude header row
      headers: headers
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message]
    };
  }
}

/**
 * Generate Excel template for employee import
 * @param {boolean} minimal - Generate minimal template with only required fields
 * @returns {Buffer} - Excel file buffer
 */
export function generateExcelTemplate(minimal = false) {
  let template;

  if (minimal) {
    // Minimal template with only required fields
    template = [
      {
        'Employee ID': 'EMP001',
        'UserID': 'USER001',
        'Name': 'John Doe',
        'Email': 'john.doe@company.com'
      },
      {
        'Employee ID': 'EMP002',
        'UserID': 'USER002',
        'Name': 'Jane Smith',
        'Email': 'jane.smith@company.com'
      }
    ];
  } else {
    // Full template with all fields
    template = [
      {
        'employee_id': 'EMP001',
        'user_id': 'USER001',
        'name': 'John Doe',
        'email': 'john.doe@company.com'
      },
      {
        'employee_id': 'EMP002',
        'user_id': 'USER002',
        'name': 'Jane Smith',
        'email': 'jane.smith@company.com'
      }
    ];
  }

  const worksheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');

  // Add column widths
  if (minimal) {
    worksheet['!cols'] = [
      { wch: 15 }, // Employee ID
      { wch: 12 }, // UserID
      { wch: 20 }, // Name
      { wch: 30 }  // Email
    ];
  } else {
    worksheet['!cols'] = [
      { wch: 12 }, // employee_id
      { wch: 12 }, // user_id
      { wch: 20 }, // name
      { wch: 30 }  // email
    ];
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export default {
  parseEmployeeExcel,
  importEmployeesFromExcel,
  validateExcelFormat,
  generateExcelTemplate
};
