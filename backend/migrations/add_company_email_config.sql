-- ============================================
-- Add Email Configuration to Companies Table
-- ============================================
-- This migration adds per-company email configuration for LOG requests

-- Add email configuration columns to public.companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS log_request_email_to VARCHAR(500),
ADD COLUMN IF NOT EXISTS log_request_email_cc VARCHAR(500),
ADD COLUMN IF NOT EXISTS log_request_keywords TEXT[] DEFAULT ARRAY['request log', 'send logs', 'need log'];

-- Add comment for documentation
COMMENT ON COLUMN public.companies.log_request_email_to IS 'Comma-separated list of primary support team emails for LOG requests';
COMMENT ON COLUMN public.companies.log_request_email_cc IS 'Comma-separated list of CC recipients for LOG requests';
COMMENT ON COLUMN public.companies.log_request_keywords IS 'Array of keywords that trigger LOG request mode';

-- Update existing companies with default values (optional - can be set via admin UI)
-- Uncomment the lines below to set default values for existing companies
-- UPDATE public.companies SET log_request_email_to = 'support@company-a.com' WHERE schema_name = 'company_a';
-- UPDATE public.companies SET log_request_email_to = 'support@company-b.com' WHERE schema_name = 'company_b';

-- Verify changes
SELECT id, name, schema_name, log_request_email_to, log_request_keywords FROM public.companies;
