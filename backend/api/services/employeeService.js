import supabase from '../../config/supabase.js';
import { generateEmbedding, generateEmbeddingsBatch } from './openai.js';

/**
 * Add employee with embedding
 * @param {Object} employeeData - Employee information
 * @param {Object} supabaseClient - Company-specific Supabase client
 * @returns {Promise<Object>} - Created employee
 */
export async function addEmployee(employeeData, supabaseClient = null) {
  const client = supabaseClient || supabase;

  try {
    // Insert employee data
    const { data: employee, error: empError } = await client
      .from('employees')
      .insert([employeeData])
      .select()
      .single();

    if (empError) {
      throw new Error(`Failed to add employee: ${empError.message}`);
    }

    // Generate embedding content
    const embeddingContent = `
      Employee: ${employeeData.name}
      Employee ID: ${employeeData.employee_id || 'N/A'}
      User ID: ${employeeData.user_id || 'N/A'}
      Email: ${employeeData.email || 'N/A'}
    `.trim();

    const embedding = await generateEmbedding(embeddingContent);

    // Store employee embedding
    const { error: embError } = await client
      .from('employee_embeddings')
      .insert([{
        employee_id: employee.id,
        content: embeddingContent,
        embedding
      }]);

    if (embError) {
      console.error('Failed to add employee embedding:', embError);
    }

    return employee;
  } catch (error) {
    console.error('Error adding employee:', error.message);
    throw error;
  }
}

/**
 * Add multiple employees in batch
 * @param {Array} employeesData - Array of employee objects
 * @param {Object} supabaseClient - Company-specific Supabase client
 * @returns {Promise<Array>} - Array of created employees
 */
export async function addEmployeesBatch(employeesData, supabaseClient = null) {
  const client = supabaseClient || supabase;

  try {
    // Insert employees
    const { data: employees, error: empError } = await client
      .from('employees')
      .insert(employeesData)
      .select();

    if (empError) {
      throw new Error(`Failed to add employees: ${empError.message}`);
    }

    // Generate embeddings for all employees
    const embeddingContents = employees.map(emp => `
      Employee: ${emp.name}
      Employee ID: ${emp.employee_id || 'N/A'}
      User ID: ${emp.user_id || 'N/A'}
      Email: ${emp.email || 'N/A'}
    `.trim());

    const embeddings = await generateEmbeddingsBatch(embeddingContents);

    // Prepare employee embeddings
    const employeeEmbeddings = employees.map((emp, idx) => ({
      employee_id: emp.id,
      content: embeddingContents[idx],
      embedding: embeddings[idx]
    }));

    // Insert embeddings
    const { error: embError } = await client
      .from('employee_embeddings')
      .insert(employeeEmbeddings);

    if (embError) {
      console.error('Failed to add employee embeddings:', embError);
    }

    return employees;
  } catch (error) {
    console.error('Error adding employees batch:', error.message);
    throw error;
  }
}

/**
 * Update multiple employees in batch with embedding regeneration
 * @param {Array} employeesData - Array of {id, updateData} objects
 * @param {Object} supabaseClient - Company-specific Supabase client
 * @returns {Promise<Array>} - Array of updated employees
 */
export async function updateEmployeesBatch(employeesData, supabaseClient = null) {
  const client = supabaseClient || supabase;

  try {

    // Update employees in batches to avoid payload size limits
    const BATCH_SIZE = 100;
    let allUpdatedEmployees = [];

    for (let i = 0; i < employeesData.length; i += BATCH_SIZE) {
      const batch = employeesData.slice(i, i + BATCH_SIZE);

      // Update each employee in the batch (Supabase doesn't support bulk update with different values easily)
      // But we can do it faster by using Promise.all for parallel updates
      const updatePromises = batch.map(({ id, updateData }) =>
        client
          .from('employees')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()
      );

      const results = await Promise.all(updatePromises);
      const batchUpdatedEmployees = results
        .filter(r => !r.error)
        .map(r => r.data);

      allUpdatedEmployees = allUpdatedEmployees.concat(batchUpdatedEmployees);

      // Generate embeddings for this batch
      const embeddingContents = batchUpdatedEmployees.map(emp => `
        Employee: ${emp.name}
        Employee ID: ${emp.employee_id || 'N/A'}
        User ID: ${emp.user_id || 'N/A'}
        Email: ${emp.email || 'N/A'}
      `.trim());

      const embeddings = await generateEmbeddingsBatch(embeddingContents);

      // Prepare employee embeddings
      const employeeEmbeddings = batchUpdatedEmployees.map((emp, idx) => ({
        employee_id: emp.id,
        content: embeddingContents[idx],
        embedding: embeddings[idx],
        updated_at: new Date().toISOString()
      }));

      // Delete existing embeddings for these employees, then insert new ones
      const employeeIds = batchUpdatedEmployees.map(emp => emp.id);

      await client
        .from('employee_embeddings')
        .delete()
        .in('employee_id', employeeIds);

      // Insert new embeddings
      const { error: embError } = await client
        .from('employee_embeddings')
        .insert(employeeEmbeddings);

      if (embError) {
        console.error('[Batch Update] Failed to insert employee embeddings:', embError);
      }

    }

    return allUpdatedEmployees;
  } catch (error) {
    console.error('Error updating employees batch:', error.message);
    throw error;
  }
}

/**
 * Get employee by employee ID
 * @param {string} employeeId - Employee ID
 * @returns {Promise<Object>} - Employee data
 */
export async function getEmployeeByEmployeeId(employeeId, supabaseClient = null, includeInactive = false) {
  try {
    // Use provided client or fallback to default
    const client = supabaseClient || supabase;

    // Build query with optional active status filter
    let query = client
      .from('employees')
      .select('*')
      .eq('employee_id', employeeId);

    // Filter by active status unless includeInactive is true
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Employee lookup failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      const statusMsg = includeInactive ? 'Employee not found' : 'Active employee not found';
      throw new Error(`${statusMsg} with ID: ${employeeId}`);
    }

    // If duplicates exist, warn but use most recent
    if (data.length > 1) {
      console.warn(`[Warning] Multiple employees found with employee_id: ${employeeId}. Using most recent entry.`);
    }

    return data[0];
  } catch (error) {
    console.error('Error getting employee:', error.message);
    throw error;
  }
}

/**
 * Get employee by email
 * @param {string} email - Employee email
 * @param {Object} supabaseClient - Company-specific Supabase client
 * @returns {Promise<Object>} - Employee data
 */
export async function getEmployeeByEmail(email, supabaseClient = null, includeInactive = false) {
  const client = supabaseClient || supabase;

  try {
    // Build query with optional active status filter
    let query = client
      .from('employees')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    // Filter by active status unless includeInactive is true
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Employee lookup failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`Employee not found with email: ${email}`);
    }

    // If duplicates exist, warn but use most recent
    if (data.length > 1) {
      console.warn(`[Warning] Multiple employees found with email: ${email}. Using most recent entry.`);
    }

    return data[0];
  } catch (error) {
    console.error('Error getting employee by email:', error.message);
    throw error;
  }
}

/**
 * Get employee by user_id
 * @param {string} userId - User ID from admin_users table
 * @param {Object} supabaseClient - Supabase client (for multi-tenancy)
 * @param {boolean} includeInactive - Whether to include inactive employees
 * @returns {Promise<Object>} - Employee data
 */
export async function getEmployeeByUserId(userId, supabaseClient = null, includeInactive = false) {
  const client = supabaseClient || supabase;

  try {
    // Build query with optional active status filter
    let query = client
      .from('employees')
      .select('*')
      .eq('user_id', userId);

    // Filter by active status unless includeInactive is true
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Employee not found with user_id: ${userId}`);
      }
      throw new Error(`Employee lookup failed: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error getting employee by user_id:', error.message);
    throw error;
  }
}

/**
 * Flexible employee lookup - tries a single identifier value against all columns
 * @param {string|Object} identifier - Either a string value or object with employeeId/userId/email
 * @param {Object} supabaseClient - Supabase client (for multi-tenancy)
 * @param {boolean} includeInactive - Whether to include inactive employees
 * @returns {Promise<Object>} - Employee data
 */
export async function getEmployeeByIdentifier(identifier, supabaseClient = null, includeInactive = false) {
  // Support both string and object input for backwards compatibility
  let searchValue;

  if (typeof identifier === 'string') {
    searchValue = identifier;
  } else {
    const { employeeId, userId, email } = identifier;
    searchValue = email || userId || employeeId;
  }

  if (!searchValue) {
    throw new Error('Identifier value is required');
  }

  const client = supabaseClient || supabase;

  // Single query checking all identifier columns at once
  let query = client
    .from('employees')
    .select('*')
    .or(`email.eq.${searchValue},user_id.eq.${searchValue},employee_id.eq.${searchValue}`);

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw new Error(`Employee lookup failed: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Employee not found with identifier: ${searchValue}`);
  }

  return data;
}

/**
 * Update employee and regenerate embedding
 * @param {string} employeeId - Employee UUID
 * @param {Object} updateData - Fields to update
 * @param {Object} supabaseClient - Company-specific Supabase client
 * @returns {Promise<Object>} - Updated employee
 */
export async function updateEmployee(employeeId, updateData, supabaseClient = null) {
  const client = supabaseClient || supabase;

  try {
    // Update employee data
    const { data: employee, error: updateError } = await client
      .from('employees')
      .update(updateData)
      .eq('id', employeeId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update employee: ${updateError.message}`);
    }

    // Regenerate embedding with updated data
    const embeddingContent = `
      Employee: ${employee.name}
      Employee ID: ${employee.employee_id || 'N/A'}
      User ID: ${employee.user_id || 'N/A'}
      Email: ${employee.email || 'N/A'}
    `.trim();

    const embedding = await generateEmbedding(embeddingContent);

    // Update or insert employee embedding
    // First try to update existing embedding
    const { data: existingEmbedding } = await client
      .from('employee_embeddings')
      .select('id')
      .eq('employee_id', employeeId)
      .single();

    if (existingEmbedding) {
      // Update existing embedding
      await client
        .from('employee_embeddings')
        .update({
          content: embeddingContent,
          embedding,
          updated_at: new Date().toISOString()
        })
        .eq('employee_id', employeeId);
    } else {
      // Insert new embedding if doesn't exist
      await client
        .from('employee_embeddings')
        .insert([{
          employee_id: employeeId,
          content: embeddingContent,
          embedding
        }]);
    }

    return employee;
  } catch (error) {
    console.error('Error updating employee:', error.message);
    throw error;
  }
}

/**
 * Deactivate an employee (soft delete)
 * @param {string} employeeId - Employee UUID
 * @param {Object} options - Deactivation options
 * @param {string} options.reason - Reason for deactivation
 * @param {string} options.deactivatedBy - Who deactivated the employee
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} - Deactivated employee data
 */
export async function deactivateEmployee(employeeId, options = {}, supabaseClient = null) {
  try {
    const client = supabaseClient || supabase;
    const { reason, deactivatedBy } = options;

    const updateData = {
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: deactivatedBy || 'system',
      deactivation_reason: reason || 'No reason provided'
    };

    const { data, error } = await client
      .from('employees')
      .update(updateData)
      .eq('id', employeeId)
      .eq('is_active', true)  // Only deactivate if currently active
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to deactivate employee: ${error.message}`);
    }

    if (!data) {
      throw new Error('Employee not found or already inactive');
    }

    return data;
  } catch (error) {
    console.error('Error deactivating employee:', error.message);
    throw error;
  }
}

/**
 * Reactivate a previously deactivated employee
 * @param {string} employeeId - Employee UUID
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} - Reactivated employee data
 */
export async function reactivateEmployee(employeeId, supabaseClient = null) {
  try {
    const client = supabaseClient || supabase;

    const updateData = {
      is_active: true,
      deactivated_at: null,
      deactivated_by: null,
      deactivation_reason: null
    };

    const { data, error } = await client
      .from('employees')
      .update(updateData)
      .eq('id', employeeId)
      .eq('is_active', false)  // Only reactivate if currently inactive
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reactivate employee: ${error.message}`);
    }

    if (!data) {
      throw new Error('Employee not found or already active');
    }

    return data;
  } catch (error) {
    console.error('Error reactivating employee:', error.message);
    throw error;
  }
}

/**
 * Deactivate multiple employees in bulk
 * @param {Array<string>} employeeIds - Array of employee UUIDs
 * @param {Object} options - Deactivation options
 * @param {string} options.reason - Reason for deactivation
 * @param {string} options.deactivatedBy - Who deactivated the employees
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} - Result with success count
 */
export async function deactivateEmployeesBulk(employeeIds, options = {}, supabaseClient = null) {
  try {
    const client = supabaseClient || supabase;
    const { reason, deactivatedBy } = options;

    const updateData = {
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: deactivatedBy || 'system',
      deactivation_reason: reason || 'Bulk deactivation'
    };

    const { data, error } = await client
      .from('employees')
      .update(updateData)
      .in('id', employeeIds)
      .eq('is_active', true)
      .select();

    if (error) {
      throw new Error(`Failed to bulk deactivate employees: ${error.message}`);
    }


    return {
      deactivated: data.length,
      employees: data
    };
  } catch (error) {
    console.error('Error bulk deactivating employees:', error.message);
    throw error;
  }
}
