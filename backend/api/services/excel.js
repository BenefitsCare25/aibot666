import XLSX from 'xlsx';
import { addEmployeesBatch } from './vectorDB.js';
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

  const department = getField(row, [
    'department', 'Department', 'Dept'
  ]);

  const policyType = getField(row, [
    'policy_type', 'Policy Type', 'PolicyType', 'Policy', 'Plan'
  ]);

  const coverageLimit = parseFloat(getField(row, [
    'coverage_limit', 'Coverage Limit', 'CoverageLimit', 'Coverage', 'Total Coverage'
  ]) || 0);

  const annualClaimLimit = parseFloat(getField(row, [
    'annual_claim_limit', 'Annual Claim Limit', 'AnnualClaimLimit', 'Annual Limit', 'Claim Limit'
  ]) || 0);

  const outpatientLimit = parseFloat(getField(row, [
    'outpatient_limit', 'Outpatient Limit', 'OutpatientLimit', 'Outpatient'
  ]) || 0);

  const dentalLimit = parseFloat(getField(row, [
    'dental_limit', 'Dental Limit', 'DentalLimit', 'Dental'
  ]) || 0);

  const opticalLimit = parseFloat(getField(row, [
    'optical_limit', 'Optical Limit', 'OpticalLimit', 'Optical'
  ]) || 0);

  const policyStartDate = parseExcelDate(getField(row, [
    'policy_start_date', 'Policy Start Date', 'StartDate', 'Start Date', 'Effective Date'
  ]));

  const policyEndDate = parseExcelDate(getField(row, [
    'policy_end_date', 'Policy End Date', 'EndDate', 'End Date', 'Expiry Date'
  ]));

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

  // Use default policy type if not provided
  const finalPolicyType = policyType || 'Standard';

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
    department: department ? String(department).trim() : null,
    policy_type: String(finalPolicyType).trim(),
    coverage_limit: coverageLimit,
    annual_claim_limit: annualClaimLimit,
    outpatient_limit: outpatientLimit || null,
    dental_limit: dentalLimit || null,
    optical_limit: opticalLimit || null,
    policy_start_date: policyStartDate,
    policy_end_date: policyEndDate,
    dependents: [],
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
 * @returns {Promise<Object>} - Import results
 */
export async function importEmployeesFromExcel(filePath) {
  try {
    console.log('Parsing Excel file...');
    const employees = await parseEmployeeExcel(filePath);

    console.log(`Found ${employees.length} employees in Excel file`);

    if (employees.length === 0) {
      return {
        success: true,
        imported: 0,
        errors: [],
        message: 'No employees to import'
      };
    }

    console.log('Importing to database with embeddings...');
    const imported = await addEmployeesBatch(employees);

    return {
      success: true,
      imported: imported.length,
      errors: [],
      message: `Successfully imported ${imported.length} employees`
    };
  } catch (error) {
    console.error('Error importing employees:', error);
    return {
      success: false,
      imported: 0,
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
        'Email': 'john.doe@company.com',
        'Policy Type': 'Premium'
      },
      {
        'Employee ID': 'EMP002',
        'UserID': 'USER002',
        'Name': 'Jane Smith',
        'Email': 'jane.smith@company.com',
        'Policy Type': 'Standard'
      }
    ];
  } else {
    // Full template with all fields
    template = [
      {
        'employee_id': 'EMP001',
        'user_id': 'USER001',
        'name': 'John Doe',
        'email': 'john.doe@company.com',
        'department': 'Engineering',
        'policy_type': 'Premium',
        'coverage_limit': 100000,
        'annual_claim_limit': 50000,
        'outpatient_limit': 10000,
        'dental_limit': 2000,
        'optical_limit': 1000,
        'policy_start_date': '2024-01-01',
        'policy_end_date': '2024-12-31'
      },
      {
        'employee_id': 'EMP002',
        'user_id': 'USER002',
        'name': 'Jane Smith',
        'email': 'jane.smith@company.com',
        'department': 'Marketing',
        'policy_type': 'Standard',
        'coverage_limit': 50000,
        'annual_claim_limit': 25000,
        'outpatient_limit': 5000,
        'dental_limit': 1000,
        'optical_limit': 500,
        'policy_start_date': '2024-01-01',
        'policy_end_date': '2024-12-31'
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
      { wch: 30 }, // Email
      { wch: 15 }  // Policy Type
    ];
  } else {
    worksheet['!cols'] = [
      { wch: 12 }, // employee_id
      { wch: 12 }, // user_id
      { wch: 20 }, // name
      { wch: 30 }, // email
      { wch: 15 }, // department
      { wch: 15 }, // policy_type
      { wch: 15 }, // coverage_limit
      { wch: 18 }, // annual_claim_limit
      { wch: 17 }, // outpatient_limit
      { wch: 14 }, // dental_limit
      { wch: 14 }, // optical_limit
      { wch: 18 }, // policy_start_date
      { wch: 18 }  // policy_end_date
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
