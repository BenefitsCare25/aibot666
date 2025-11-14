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
 * @param {string} policyType - Optional policy type filter (e.g., 'Premium', 'Standard')
 * @returns {Promise<Array>} - Array of matching knowledge base entries
 */
export async function searchKnowledgeBase(query, supabaseClient = null, topK = TOP_K_RESULTS, threshold = SIMILARITY_THRESHOLD, category = null, policyType = null) {
  try {
    console.log('[Knowledge Search] Starting search...');
    console.log(`[Knowledge Search] Query: "${query}"`);
    console.log(`[Knowledge Search] Parameters: topK=${topK}, threshold=${threshold}, policyType=${policyType || 'none'}`);

    // Use provided client or fallback to default
    const client = supabaseClient || supabase;

    // Generate embedding for the query
    console.log('[Knowledge Search] Generating query embedding...');
    const queryEmbedding = await generateEmbedding(query);
    console.log(`[Knowledge Search] ✅ Generated embedding with ${queryEmbedding.length} dimensions`);

    // First check if ANY knowledge exists with very low threshold (0.1)
    // This helps us differentiate between "no data" vs "low similarity data"
    console.log('[Knowledge Search] Checking if ANY knowledge exists (threshold 0.1)...');
    const { data: anyData } = await client.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: 1
    });

    const hasAnyKnowledge = anyData && anyData.length > 0;
    console.log(`[Knowledge Search] Any knowledge exists: ${hasAnyKnowledge ? 'YES' : 'NO'}`);
    if (hasAnyKnowledge) {
      console.log(`[Knowledge Search] Best match at 0.1 threshold: similarity=${anyData[0].similarity.toFixed(4)}, title="${anyData[0].title}"`);
    }

    // Use Supabase RPC to call the match_knowledge function with actual threshold
    // Fetch more results initially if we're going to filter by policy type
    const fetchCount = policyType ? topK * 3 : topK;

    console.log(`[Knowledge Search] Searching with threshold ${threshold}, fetching ${fetchCount} results...`);
    let rpcQuery = client.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: fetchCount
    });

    const { data, error } = await rpcQuery;

    if (error) {
      console.error('[Knowledge Search] ❌ RPC Error:', error);
      throw new Error(`Vector search failed: ${error.message}`);
    }

    let results = data || [];
    console.log(`[Knowledge Search] RPC returned ${results.length} results with threshold ${threshold}`);

    // Log all results before filtering
    if (results.length > 0) {
      console.log('[Knowledge Search] Results before policy filtering:');
      results.forEach((item, idx) => {
        console.log(`  ${idx + 1}. Similarity: ${item.similarity.toFixed(4)}, Category: ${item.category}, Subcategory: ${item.subcategory || 'none'}, Title: "${item.title || '(no title)'}"`);
      });
    } else {
      console.log('[Knowledge Search] ⚠️ No results found at threshold ' + threshold);
      if (hasAnyKnowledge) {
        console.log('[Knowledge Search] ⚠️ Knowledge exists but similarity is too low!');
        console.log(`[Knowledge Search] 💡 Best similarity was ${anyData[0].similarity.toFixed(4)} but threshold is ${threshold}`);
        console.log('[Knowledge Search] 💡 Consider lowering similarity_threshold in AI settings');
      } else {
        console.log('[Knowledge Search] ❌ No knowledge exists in database for this query');
      }
    }

    // Apply policy type filtering if provided
    if (policyType && results.length > 0) {
      console.log(`[Knowledge Search] Applying policy type filter: ${policyType}`);
      const beforeFilterCount = results.length;

      // Define benefit types that should always be included regardless of policy
      const benefitTypes = ['dental', 'optical', 'health_insurance', 'maternity', 'claims', 'submission'];

      results = results.filter(item => {
        // Include if no subcategory (general knowledge)
        if (!item.subcategory) return true;

        // Include if subcategory is 'general'
        if (item.subcategory.toLowerCase() === 'general') return true;

        // Include if subcategory matches the employee's policy type
        if (item.subcategory.toLowerCase() === policyType.toLowerCase()) return true;

        // Include if subcategory is a benefit type (not policy-specific)
        if (benefitTypes.includes(item.subcategory.toLowerCase())) return true;

        // Exclude otherwise (different policy type)
        return false;
      });

      // Limit to requested topK after filtering
      results = results.slice(0, topK);

      console.log(`[Knowledge Search] Policy filtering: Retrieved ${beforeFilterCount} items → filtered to ${results.length} items`);

      if (beforeFilterCount > 0 && results.length === 0) {
        console.log('[Knowledge Search] ⚠️ Policy filter excluded ALL results!');
        console.log(`[Knowledge Search] 💡 Employee policy type "${policyType}" filtered out all matches`);
      }
    }

    // Log final results
    console.log(`[Knowledge Search] Final result count: ${results.length}`);
    if (results.length > 0) {
      console.log('[Knowledge Search] ✅ Returning results:');
      results.forEach((item, idx) => {
        console.log(`  ${idx + 1}. Similarity: ${item.similarity.toFixed(4)}, Title: "${item.title || '(no title)'}"`);
      });
    }

    // Update usage statistics for retrieved documents
    if (results && results.length > 0) {
      const ids = results.map(item => item.id);
      await updateKnowledgeUsage(ids, client);
    }

    // Return data with metadata about whether ANY knowledge exists
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
 * @param {string} currentEmployeeId - Current employee's ID (for filtering to prevent data leakage)
 * @returns {Promise<Array>} - Array of matching employee entries
 */
export async function searchEmployeeData(query, topK = 3, threshold = 0.6, currentEmployeeId = null) {
  try {
    // SECURITY WARNING: This function is currently DISABLED for production use
    // It can potentially expose other employees' data through semantic search
    console.warn('searchEmployeeData called - this function should only be used for self-lookup');

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

      // SECURITY: Build query with employee filter
      let query = supabase
        .from('employees')
        .select('*')
        .in('id', employeeIds);

      // CRITICAL: If currentEmployeeId is provided, ONLY return that employee's data
      if (currentEmployeeId) {
        query = query.eq('id', currentEmployeeId);
        console.log(`Security filter applied: restricting results to employee ${currentEmployeeId}`);
      } else {
        // If no employee filter provided, log a security warning
        console.warn('SECURITY WARNING: searchEmployeeData called without currentEmployeeId filter - potential data leak');
      }

      const { data: employees, error: empError } = await query;

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
 * @param {Object} supabaseClient - Supabase client (for multi-tenancy)
 * @returns {Promise<Object>} - Created entry
 */
export async function addKnowledgeEntry(entry, supabaseClient = null) {
  try {
    // Use provided client or fallback to default
    const client = supabaseClient || supabase;

    const { title, content, category, subcategory, metadata, source } = entry;

    if (!content || !category) {
      throw new Error('Content and category are required');
    }

    // Generate embedding for title + content (improves search relevance for question-style queries)
    const embeddingText = title ? `${title}\n\n${content}` : content;
    const embedding = await generateEmbedding(embeddingText);

    const { data, error } = await client
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
 * @param {Object} supabaseClient - Supabase client (for multi-tenancy)
 * @returns {Promise<Array>} - Array of created entries
 */
export async function addKnowledgeEntriesBatch(entries, supabaseClient = null) {
  try {
    // Use provided client or fallback to default
    const client = supabaseClient || supabase;

    if (!entries || entries.length === 0) {
      throw new Error('Entries array cannot be empty');
    }

    // Extract title + content for batch embedding generation (improves search relevance)
    const embeddingTexts = entries.map(e =>
      e.title ? `${e.title}\n\n${e.content}` : e.content
    );
    const embeddings = await generateEmbeddingsBatch(embeddingTexts);

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

    const { data, error } = await client
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
 * @param {Object} supabaseClient - Supabase client (for multi-tenancy)
 * @returns {Promise<Object>} - Updated entry
 */
export async function updateKnowledgeEntry(id, updates, supabaseClient = null) {
  try {
    // Use provided client or fallback to default
    const client = supabaseClient || supabase;

    // If content or title is updated, regenerate embedding
    if (updates.content || updates.title) {
      // Need to fetch current entry to get title/content if only one is being updated
      const { data: currentEntry } = await client
        .from('knowledge_base')
        .select('title, content')
        .eq('id', id)
        .single();

      const title = updates.title !== undefined ? updates.title : currentEntry?.title;
      const content = updates.content !== undefined ? updates.content : currentEntry?.content;

      // Generate embedding with title + content
      const embeddingText = title ? `${title}\n\n${content}` : content;
      updates.embedding = await generateEmbedding(embeddingText);
    }

    const { data, error } = await client
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
 * @param {Object} supabaseClient - Supabase client (for multi-tenancy)
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteKnowledgeEntry(id, supabaseClient = null) {
  try {
    // Use provided client or fallback to default
    const client = supabaseClient || supabase;

    const { error } = await client
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
 * Update usage statistics for knowledge base entries
 * @param {Array} ids - Array of knowledge base entry IDs
 */
async function updateKnowledgeUsage(ids, supabaseClient = null) {
  try {
    // Use provided client or fallback to default
    const client = supabaseClient || supabase;

    // Call RPC function to increment usage count atomically
    // This requires the increment_knowledge_usage function in each company schema
    const { error } = await client.rpc('increment_knowledge_usage', {
      knowledge_ids: ids
    });

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

    // Query without .single() to handle potential duplicates
    const { data, error } = await client
      .from('employees')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Employee lookup failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`Employee not found with ID: ${employeeId}`);
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
export async function getEmployeeByEmail(email, supabaseClient = null) {
  const client = supabaseClient || supabase;

  try {
    // Query without .single() to handle potential duplicates
    const { data, error } = await client
      .from('employees')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

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
      Department: ${employee.department}
      Policy Type: ${employee.policy_type}
      Coverage Limit: ${employee.coverage_limit}
      Annual Claim Limit: ${employee.annual_claim_limit}
      Outpatient Limit: ${employee.outpatient_limit}
      Dental Limit: ${employee.dental_limit}
      Optical Limit: ${employee.optical_limit}
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

export default {
  searchKnowledgeBase,
  searchEmployeeData,
  addKnowledgeEntry,
  addKnowledgeEntriesBatch,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  addEmployee,
  addEmployeesBatch,
  updateEmployee,
  getEmployeeByEmployeeId,
  getEmployeeByEmail
};
