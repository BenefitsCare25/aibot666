-- Add CBRE Company
-- This script adds the CBRE company to the companies registry
-- IMPORTANT: Domain includes the path /cbre for multi-tenant routing on same base domain

-- Insert CBRE company (update if exists)
INSERT INTO public.companies (name, domain, additional_domains, schema_name, status, settings)
VALUES
  (
    'CBRE',
    'benefits.inspro.com.sg/cbre',
    ARRAY['www.benefits.inspro.com.sg/cbre', 'localhost/cbre'],
    'cbre',
    'active',
    '{"brandColor": "#0066cc", "features": ["escalation", "analytics", "quick_questions"]}'::JSONB
  )
ON CONFLICT (domain) DO UPDATE SET
  name = EXCLUDED.name,
  additional_domains = EXCLUDED.additional_domains,
  schema_name = EXCLUDED.schema_name,
  status = EXCLUDED.status,
  settings = EXCLUDED.settings,
  updated_at = NOW();

-- Verify CBRE company was created/updated
SELECT id, name, domain, schema_name, status FROM public.companies WHERE domain = 'benefits.inspro.com.sg/cbre';

-- Multi-tenant architecture explanation:
-- benefits.inspro.com.sg/cbre   -> routes to 'cbre' schema
-- benefits.inspro.com.sg/companyb -> routes to 'companyb' schema
-- Each path segment acts as the tenant identifier
