-- Company Registry Schema
-- This file creates the company registry in the public schema for multi-tenant support

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
-- Note: This requires proper authentication setup in your application
CREATE POLICY companies_admin_all ON public.companies
  FOR ALL
  USING (true); -- Modify this based on your auth requirements

-- Insert a default company for existing data migration
INSERT INTO public.companies (name, domain, schema_name, status, settings)
VALUES (
  'Default Company',
  'localhost',
  'company_default',
  'active',
  '{"isDefault": true}'::JSONB
)
ON CONFLICT (domain) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE public.companies IS 'Registry of all companies in the multi-tenant system';
COMMENT ON COLUMN public.companies.domain IS 'Primary domain used to identify company from widget embedding';
COMMENT ON COLUMN public.companies.additional_domains IS 'Array of additional domains that map to this company';
COMMENT ON COLUMN public.companies.schema_name IS 'PostgreSQL schema name where company data is stored';
COMMENT ON COLUMN public.companies.settings IS 'Company-specific settings like branding, feature flags, etc.';
