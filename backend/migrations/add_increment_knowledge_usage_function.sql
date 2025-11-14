-- Migration: Add increment_knowledge_usage function to existing schemas
-- This function is used to track knowledge base usage statistics
-- Date: 2025-11-14

-- Add to CBRE schema
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

-- Add to Company A schema (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'company_a') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION company_a.increment_knowledge_usage(knowledge_ids UUID[])
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $func$
      BEGIN
        UPDATE company_a.knowledge_base
        SET
          usage_count = COALESCE(usage_count, 0) + 1,
          last_used_at = NOW()
        WHERE id = ANY(knowledge_ids);
      END;
      $func$;
    ';
  END IF;
END $$;

-- Add to Company B schema (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'company_b') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION company_b.increment_knowledge_usage(knowledge_ids UUID[])
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $func$
      BEGIN
        UPDATE company_b.knowledge_base
        SET
          usage_count = COALESCE(usage_count, 0) + 1,
          last_used_at = NOW()
        WHERE id = ANY(knowledge_ids);
      END;
      $func$;
    ';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added increment_knowledge_usage function to all existing schemas';
END $$;
