-- Check how many rows are in each table (affects DROP SCHEMA CASCADE speed)
-- Run this in your Supabase SQL Editor to see if you have large amounts of data

SELECT
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname IN ('company_a', 'company_b', 'cbre')
ORDER BY schemaname, n_live_tup DESC;

-- Check for active connections that might be blocking the DROP
SELECT
  pid,
  usename,
  application_name,
  state,
  query,
  state_change
FROM pg_stat_activity
WHERE datname = 'postgres'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY state_change DESC;

-- Check for locks that might be blocking the DROP
SELECT
  l.pid,
  l.mode,
  l.granted,
  a.query,
  a.state
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.relation IN (
  SELECT c.oid
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname IN ('company_a', 'company_b', 'cbre')
)
ORDER BY l.granted;
