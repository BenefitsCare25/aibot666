import supabase from '../../config/supabase.js';
import { generateEmbedding, generateEmbeddingsBatch } from './openai.js';
import dotenv from 'dotenv';

dotenv.config();

const SIMILARITY_THRESHOLD = parseFloat(process.env.VECTOR_SIMILARITY_THRESHOLD) || 0.55;
const TOP_K_RESULTS = parseInt(process.env.TOP_K_RESULTS) || 5;

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
 * Search knowledge base using vector similarity
 * @param {string} query - User query text
 * @param {Object} supabaseClient - Supabase client (for multi-tenancy)
 * @param {number} topK - Number of results to return
 * @param {number} threshold - Minimum similarity threshold
 * @param {string} category - Optional category filter
 * @param {string} policyType - Optional policy type filter (e.g., 'Premium', 'Standard')
 * @returns {Promise<Array>} - Array of matching knowledge base entries
 */
export async function searchKnowledgeBase(query, supabaseClient = null, topK = TOP_K_RESULTS, threshold = SIMILARITY_THRESHOLD, category = null, policyType = null, precomputedEmbedding = null) {
  try {

    // Use provided client or fallback to default
    const client = supabaseClient || supabase;

    // Reuse pre-computed embedding if provided (avoids redundant OpenAI API call)
    const queryEmbedding = precomputedEmbedding || await generateEmbedding(query);

    // Single vector search with actual threshold (removed duplicate low-threshold check)
    // Fetch more results initially if we're going to filter by policy type
    const fetchCount = policyType ? topK * 3 : topK;

    const schemaName = client._schemaName || 'public';
    console.log(`[Knowledge Search] Querying schema=${schemaName}, threshold=${threshold}, topK=${fetchCount}`);

    let rpcQuery = client.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: fetchCount
    });

    const { data, error } = await rpcQuery;

    if (error) {
      console.error(`[Knowledge Search] ❌ RPC Error (schema=${schemaName}):`, error);
      throw new Error(`Vector search failed: ${error.message}`);
    }

    let results = data || [];
    console.log(`[Knowledge Search] RPC returned ${results.length} results (schema=${schemaName}, threshold=${threshold}, topK=${fetchCount})`);

    // Apply policy type filtering if provided
    if (policyType && results.length > 0) {
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
    }

    // Update usage statistics for retrieved documents
    if (results && results.length > 0) {
      const ids = results.map(item => item.id);
      await updateKnowledgeUsage(ids, client);
    }

    // Derive hasAnyKnowledge from actual results (no need for separate low-threshold query)
    results._hasAnyKnowledge = results.length > 0;

    return results;
  } catch (error) {
    console.error('Error in searchKnowledgeBase:', error.message);
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
