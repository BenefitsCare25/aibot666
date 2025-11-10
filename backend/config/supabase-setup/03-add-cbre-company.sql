-- Add CBRE Company
-- This script adds the CBRE company to the companies registry

-- Insert CBRE company (update if exists)
INSERT INTO public.companies (name, domain, additional_domains, schema_name, status, settings)
VALUES
  (
    'CBRE',
    'benefits.inspro.com.sg',
    ARRAY['www.benefits.inspro.com.sg', 'localhost'],
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
SELECT id, name, domain, schema_name, status FROM public.companies WHERE domain = 'benefits.inspro.com.sg';
