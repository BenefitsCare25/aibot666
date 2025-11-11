-- ============================================
-- Fix match_knowledge function to include subcategory
-- ============================================
-- Issue: The match_knowledge RPC function was missing the subcategory field,
-- which caused policy type filtering to fail in vectorDB.js
-- This resulted in ALL results being filtered out, leading to "0 matching contexts"

-- Fix for CBRE schema
CREATE OR REPLACE FUNCTION cbre.match_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  content TEXT,
  category VARCHAR,
  subcategory VARCHAR,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    knowledge_base.id,
    knowledge_base.title,
    knowledge_base.content,
    knowledge_base.category,
    knowledge_base.subcategory,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM cbre.knowledge_base
  WHERE knowledge_base.is_active = true
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Fix for company_a schema (if exists)
CREATE OR REPLACE FUNCTION company_a.match_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  content TEXT,
  category VARCHAR,
  subcategory VARCHAR,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    knowledge_base.id,
    knowledge_base.title,
    knowledge_base.content,
    knowledge_base.category,
    knowledge_base.subcategory,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM company_a.knowledge_base
  WHERE knowledge_base.is_active = true
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Fix for company_b schema (if exists)
CREATE OR REPLACE FUNCTION company_b.match_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  content TEXT,
  category VARCHAR,
  subcategory VARCHAR,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    knowledge_base.id,
    knowledge_base.title,
    knowledge_base.content,
    knowledge_base.category,
    knowledge_base.subcategory,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM company_b.knowledge_base
  WHERE knowledge_base.is_active = true
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
