-- ============================================
-- STEP 1: Delete Old Tables (Fresh Start)
-- ============================================
-- WARNING: This will delete ALL existing data!
-- Only run this if you're sure you don't need the current data.

-- Drop all existing tables in public schema
DROP TABLE IF EXISTS public.analytics CASCADE;
DROP TABLE IF EXISTS public.escalations CASCADE;
DROP TABLE IF EXISTS public.chat_history CASCADE;
DROP TABLE IF EXISTS public.employee_embeddings CASCADE;
DROP TABLE IF EXISTS public.knowledge_base CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;

-- Verify tables are deleted
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('analytics', 'escalations', 'chat_history', 'employee_embeddings', 'knowledge_base', 'employees');

-- Should return 0 rows if successful
