-- Add CBRE Company
-- This script adds the CBRE company to the companies registry
-- IMPORTANT: Domain includes the path /CBRE for multi-tenant routing on same base domain
-- Note: Domain lookup is now case-INSENSITIVE, so /CBRE and /cbre will both work

-- First, delete the existing CBRE entry if it exists with the wrong format
DELETE FROM public.companies WHERE domain ILIKE '%benefits.inspro.com.sg%cbre%';

-- Insert CBRE company with matching domain format from your database
INSERT INTO public.companies (name, domain, additional_domains, schema_name, status, settings)
VALUES
  (
    'CBRE',
    'https://benefits.inspro.com.sg/CBRE',
    ARRAY['www.benefits.inspro.com.sg/CBRE', 'localhost/CBRE', 'benefits.inspro.com.sg/CBRE'],
    'cbre',
    'active',
    '{"brandColor": "#0066cc", "features": ["escalation", "analytics", "quick_questions"]}'::JSONB
  );

-- Verify CBRE company was created
SELECT id, name, domain, schema_name, status FROM public.companies WHERE domain ILIKE '%cbre%';

-- Multi-tenant architecture explanation:
-- https://benefits.inspro.com.sg/CBRE -> normalizes to -> benefits.inspro.com.sg/cbre -> routes to 'cbre' schema
-- Domain matching is case-insensitive, so /CBRE, /cbre, /Cbre all work
-- Each path segment acts as the tenant identifier
