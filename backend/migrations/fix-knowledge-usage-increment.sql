-- Fix for knowledge base usage count increment
-- This creates an RPC function to atomically increment usage_count
-- Run this for EACH company schema

-- For CBRE schema
CREATE OR REPLACE FUNCTION cbre.increment_knowledge_usage(knowledge_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cbre.knowledge_base
  SET
    usage_count = COALESCE(usage_count, 0) + 1,
    last_used_at = NOW()
  WHERE id = ANY(knowledge_ids);
END;
$$;

-- Add more CREATE OR REPLACE FUNCTION statements for other company schemas as needed
-- Example for another company:
-- CREATE OR REPLACE FUNCTION company2.increment_knowledge_usage(knowledge_ids UUID[])
-- RETURNS void
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--   UPDATE company2.knowledge_base
--   SET
--     usage_count = COALESCE(usage_count, 0) + 1,
--     last_used_at = NOW()
--   WHERE id = ANY(knowledge_ids);
-- END;
-- $$;
