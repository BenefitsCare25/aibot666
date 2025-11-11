-- ============================================
-- Diagnostic: Check CBRE Knowledge Base Embeddings
-- ============================================
-- This SQL script checks if knowledge base entries have embeddings

-- Step 1: Check embedding statistics
SELECT
  COUNT(*) as total_entries,
  COUNT(embedding) as entries_with_embedding,
  COUNT(*) - COUNT(embedding) as entries_missing_embedding,
  COUNT(CASE WHEN embedding IS NOT NULL AND title IS NOT NULL THEN 1 END) as entries_with_title_and_embedding,
  COUNT(CASE WHEN embedding IS NULL AND title IS NOT NULL THEN 1 END) as entries_with_title_no_embedding
FROM cbre.knowledge_base
WHERE is_active = true;

-- Step 2: Check the specific "Panel clinic payment" entry
SELECT
  id,
  title,
  category,
  subcategory,
  SUBSTRING(content, 1, 200) as content_preview,
  CASE WHEN embedding IS NULL THEN 'NO EMBEDDING'
       WHEN embedding IS NOT NULL THEN 'HAS EMBEDDING'
  END as embedding_status,
  created_at,
  updated_at
FROM cbre.knowledge_base
WHERE title ILIKE '%payment%panel%clinic%'
   OR title ILIKE '%Why do I have to make payment at Panel clinic%'
ORDER BY created_at DESC;

-- Step 3: List all entries to see what we have
SELECT
  id,
  title,
  category,
  subcategory,
  CASE WHEN embedding IS NULL THEN 'NO' ELSE 'YES' END as has_embedding,
  created_at
FROM cbre.knowledge_base
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 20;
