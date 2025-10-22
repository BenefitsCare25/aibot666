-- ============================================
-- STEP 2: Create Company Registry
-- ============================================
-- This creates the registry table that maps domains to company schemas

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Companies table: Store company information and domain mapping
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL, -- Primary domain for company identification
  additional_domains TEXT[], -- Additional domains that map to this company
  schema_name VARCHAR(63) NOT NULL UNIQUE, -- PostgreSQL schema name (max 63 chars)
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  settings JSONB DEFAULT '{}', -- Company-specific settings (branding, features, etc.)
  metadata JSONB DEFAULT '{}', -- Additional company metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_companies_domain ON public.companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_schema ON public.companies(schema_name);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);

-- GIN index for array search on additional_domains
CREATE INDEX IF NOT EXISTS idx_companies_additional_domains ON public.companies USING GIN(additional_domains);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_companies_updated_at ON public.companies;
CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();

-- Function to validate schema name (must be valid PostgreSQL identifier)
CREATE OR REPLACE FUNCTION validate_schema_name(schema_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if schema name matches PostgreSQL identifier rules
  -- Must start with letter or underscore, contain only alphanumeric and underscore
  -- Max length 63 characters
  IF schema_name !~ '^[a-z_][a-z0-9_]*$' OR length(schema_name) > 63 THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if domain belongs to a company
CREATE OR REPLACE FUNCTION get_company_by_domain(input_domain TEXT)
RETURNS TABLE (
  company_id UUID,
  company_name VARCHAR,
  schema_name VARCHAR,
  status VARCHAR,
  settings JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.schema_name,
    c.status,
    c.settings
  FROM public.companies c
  WHERE
    c.status = 'active' AND
    (c.domain = input_domain OR input_domain = ANY(c.additional_domains))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security for companies table
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can see all companies
CREATE POLICY companies_admin_all ON public.companies
  FOR ALL
  USING (true);

-- Insert 2 companies for testing
INSERT INTO public.companies (name, domain, additional_domains, schema_name, status, settings)
VALUES
  (
    'Company A',
    'company-a.local',
    ARRAY['www.company-a.local', 'localhost'],
    'company_a',
    'active',
    '{"brandColor": "#3b82f6", "features": ["escalation", "analytics"]}'::JSONB
  ),
  (
    'Company B',
    'company-b.local',
    ARRAY['www.company-b.local'],
    'company_b',
    'active',
    '{"brandColor": "#10b981", "features": ["escalation", "analytics"]}'::JSONB
  )
ON CONFLICT (domain) DO NOTHING;

-- Verify companies were created
SELECT id, name, domain, schema_name, status FROM public.companies;

-- Should show 2 companies
