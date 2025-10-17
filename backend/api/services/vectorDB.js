import supabase from '../../config/supabase.js';
import { generateEmbedding, generateEmbeddingsBatch } from './openai.js';
import dotenv from 'dotenv';

dotenv.config();

const SIMILARITY_THRESHOLD = parseFloat(process.env.VECTOR_SIMILARITY_THRESHOLD) || 0.7;
const TOP_K_RESULTS = parseInt(process.env.TOP_K_RESULTS) || 5;

/**
 * Search knowledge base using vector similarity
 * @param {string} query - User query text
 * @param {Object} supabaseClient - Supabase client (for multi-tenancy)
 * @param {number} topK - Number of results to return
 * @param {number} threshold - Minimum similarity threshold
 * @param {string} category - Optional category filter
 * @returns {Promise<Array>} - Array of matching knowledge base entries
 */
export async function searchKnowledgeBase(query, supabaseClient = null, topK = TOP_K_RESULTS, threshold = SIMILARITY_THRESHOLD, category = null) {
  try {
    // Use provided client or fallback to default
    const client = supabaseClient || supabase;

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // First check if ANY knowledge exists with very low threshold (0.1)
    // This helps us differentiate between "no data" vs "low similarity data"
    const { data: anyData } = await client.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: 1
    });

    // Use Supabase RPC to call the match_knowledge function with actual threshold
    let rpcQuery = client.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: topK
    });

    const { data, error } = await rpcQuery;

    if (error) {
      console.error('Error searching knowledge base:', error);
      throw new Error(`Vector search failed: ${error.message}`);
    }

    // Update usage statistics for retrieved documents
    if (data && data.length > 0) {
      const ids = data.map(item => item.id);
      await updateKnowledgeUsage(ids, client);
    }

    // Return data with metadata about whether ANY knowledge exists
    const results = data || [];
    results._hasAnyKnowledge = anyData && anyData.length > 0;

    return results;
  } catch (error) {
    console.error('Error in searchKnowledgeBase:', error.message);
    throw error;
  }
}

/**
 * Search employee data using vector similarity
 * @param {string} query - Query text
 * @param {number} topK - Number of results to return
 * @param {number} threshold - Minimum similarity threshold
 * @returns {Promise<Array>} - Array of matching employee entries
 */
export async function searchEmployeeData(query, topK = 3, threshold = 0.6) {
  try {
    const queryEmbedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc('match_employees', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: topK
    });

    if (error) {
      console.error('Error searching employee data:', error);
      throw new Error(`Employee search failed: ${error.message}`);
    }

    // Fetch full employee details
    if (data && data.length > 0) {
      const employeeIds = data.map(item => item.employee_id);
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .in('id', employeeIds);

      if (empError) {
        throw new Error(`Failed to fetch employee details: ${empError.message}`);
      }

      return employees;
    }

    return [];
  } catch (error) {
    console.error('Error in searchEmployeeData:', error.message);
    throw error;
  }
}

/**
 * Add new knowledge base entry with embedding
 * @param {Object} entry - Knowledge base entry
 * @returns {Promise<Object>} - Created entry
 */
export async function addKnowledgeEntry(entry) {
  try {
    const { title, content, category, subcategory, metadata, source } = entry;

    if (!content || !category) {
      throw new Error('Content and category are required');
    }

    // Generate embedding for the content
    const embedding = await generateEmbedding(content);

    const { data, error } = await supabase
      .from('knowledge_base')
      .insert([{
        title,
        content,
        category,
        subcategory,
        embedding,
        metadata: metadata || {},
        source: source || 'admin_upload'
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add knowledge entry: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error adding knowledge entry:', error.message);
    throw error;
  }
}

/**
 * Add multiple knowledge base entries in batch
 * @param {Array} entries - Array of knowledge base entries
 * @returns {Promise<Array>} - Array of created entries
 */
export async function addKnowledgeEntriesBatch(entries) {
  try {
    if (!entries || entries.length === 0) {
      throw new Error('Entries array cannot be empty');
    }

    // Extract content for batch embedding generation
    const contents = entries.map(e => e.content);
    const embeddings = await generateEmbeddingsBatch(contents);

    // Prepare entries with embeddings
    const entriesWithEmbeddings = entries.map((entry, idx) => ({
      title: entry.title,
      content: entry.content,
      category: entry.category,
      subcategory: entry.subcategory,
      embedding: embeddings[idx],
      metadata: entry.metadata || {},
      source: entry.source || 'admin_upload'
    }));

    const { data, error } = await supabase
      .from('knowledge_base')
      .insert(entriesWithEmbeddings)
      .select();

    if (error) {
      throw new Error(`Failed to add knowledge entries: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error adding batch knowledge entries:', error.message);
    throw error;
  }
}

/**
 * Update knowledge base entry
 * @param {string} id - Entry ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated entry
 */
export async function updateKnowledgeEntry(id, updates) {
  try {
    // If content is updated, regenerate embedding
    if (updates.content) {
      updates.embedding = await generateEmbedding(updates.content);
    }

    const { data, error } = await supabase
      .from('knowledge_base')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update knowledge entry: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error updating knowledge entry:', error.message);
    throw error;
  }
}

/**
 * Delete knowledge base entry
 * @param {string} id - Entry ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteKnowledgeEntry(id) {
  try {
    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete knowledge entry: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting knowledge entry:', error.message);
    throw error;
  }
}

/**
 * Add employee with embedding
 * @param {Object} employeeData - Employee information
 * @returns {Promise<Object>} - Created employee
 */
export async function addEmployee(employeeData) {
  try {
    // Insert employee data
    const { data: employee, error: empError } = await supabase
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
      Department: ${employeeData.department}
      Policy Type: ${employeeData.policy_type}
      Coverage Limit: ${employeeData.coverage_limit}
      Annual Claim Limit: ${employeeData.annual_claim_limit}
      Outpatient Limit: ${employeeData.outpatient_limit}
      Dental Limit: ${employeeData.dental_limit}
      Optical Limit: ${employeeData.optical_limit}
    `.trim();

    const embedding = await generateEmbedding(embeddingContent);

    // Store employee embedding
    const { error: embError } = await supabase
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
 * @returns {Promise<Array>} - Array of created employees
 */
export async function addEmployeesBatch(employeesData) {
  try {
    // Insert employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .insert(employeesData)
      .select();

    if (empError) {
      throw new Error(`Failed to add employees: ${empError.message}`);
    }

    // Generate embeddings for all employees
    const embeddingContents = employees.map(emp => `
      Employee: ${emp.name}
      Department: ${emp.department}
      Policy Type: ${emp.policy_type}
      Coverage Limit: ${emp.coverage_limit}
      Annual Claim Limit: ${emp.annual_claim_limit}
      Outpatient Limit: ${emp.outpatient_limit}
      Dental Limit: ${emp.dental_limit}
      Optical Limit: ${emp.optical_limit}
    `.trim());

    const embeddings = await generateEmbeddingsBatch(embeddingContents);

    // Prepare employee embeddings
    const employeeEmbeddings = employees.map((emp, idx) => ({
      employee_id: emp.id,
      content: embeddingContents[idx],
      embedding: embeddings[idx]
    }));

    // Insert embeddings
    const { error: embError } = await supabase
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
 * Update usage statistics for knowledge base entries
 * @param {Array} ids - Array of knowledge base entry IDs
 */
async function updateKnowledgeUsage(ids, supabaseClient = null) {
  try {
    // Use provided client or fallback to default
    const client = supabaseClient || supabase;

    const { error } = await client
      .from('knowledge_base')
      .update({
        usage_count: client.raw('usage_count + 1'),
        last_used_at: new Date().toISOString()
      })
      .in('id', ids);

    if (error) {
      console.error('Error updating knowledge usage:', error);
    }
  } catch (error) {
    console.error('Error in updateKnowledgeUsage:', error);
  }
}

/**
 * Get employee by employee ID
 * @param {string} employeeId - Employee ID
 * @returns {Promise<Object>} - Employee data
 */
export async function getEmployeeByEmployeeId(employeeId, supabaseClient = null) {
  try {
    // Use provided client or fallback to default
    const client = supabaseClient || supabase;

    const { data, error } = await client
      .from('employees')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (error) {
      throw new Error(`Employee not found: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error getting employee:', error.message);
    throw error;
  }
}

/**
 * Get employee by email
 * @param {string} email - Employee email
 * @returns {Promise<Object>} - Employee data
 */
export async function getEmployeeByEmail(email) {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      throw new Error(`Employee not found: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error getting employee by email:', error.message);
    throw error;
  }
}

export default {
  searchKnowledgeBase,
  searchEmployeeData,
  addKnowledgeEntry,
  addKnowledgeEntriesBatch,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  addEmployee,
  addEmployeesBatch,
  getEmployeeByEmployeeId,
  getEmployeeByEmail
};
