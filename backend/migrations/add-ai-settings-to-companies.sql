-- Migration: Add AI settings to companies table
-- Date: 2025-11-11
-- Purpose: Allow per-company customization of AI model, prompt, and parameters

-- Add ai_settings column to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT '{}'::jsonb;

-- Add comment describing the structure
COMMENT ON COLUMN public.companies.ai_settings IS
'Per-company AI configuration settings. Structure:
{
  "model": "gpt-4o",                    // AI model to use
  "temperature": 0,                     // Response randomness (0-1)
  "max_tokens": 1000,                   // Max response length
  "embedding_model": "text-embedding-3-small",  // Embedding model
  "similarity_threshold": 0.7,          // Vector search threshold
  "top_k_results": 5,                   // Number of context chunks
  "system_prompt": "Custom prompt...",  // Override default system prompt
  "escalation_threshold": 0.5,          // Confidence threshold for escalation
  "use_global_defaults": true           // If true, fall back to env defaults
}';

-- Set default AI settings for existing companies (use global defaults)
UPDATE public.companies
SET ai_settings = jsonb_build_object(
  'use_global_defaults', true,
  'model', 'gpt-4o',
  'temperature', 0,
  'max_tokens', 1000,
  'embedding_model', 'text-embedding-3-small',
  'similarity_threshold', 0.7,
  'top_k_results', 5,
  'escalation_threshold', 0.5,
  'system_prompt', null
)
WHERE ai_settings = '{}'::jsonb OR ai_settings IS NULL;

-- Create index for querying ai_settings
CREATE INDEX IF NOT EXISTS idx_companies_ai_settings
ON public.companies USING gin(ai_settings);

-- Create a function to validate ai_settings JSON structure
CREATE OR REPLACE FUNCTION validate_ai_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure ai_settings is a valid JSON object
  IF NEW.ai_settings IS NOT NULL AND jsonb_typeof(NEW.ai_settings) != 'object' THEN
    RAISE EXCEPTION 'ai_settings must be a JSON object';
  END IF;

  -- Validate temperature range (0 to 1)
  IF NEW.ai_settings ? 'temperature' THEN
    IF (NEW.ai_settings->>'temperature')::numeric < 0 OR
       (NEW.ai_settings->>'temperature')::numeric > 1 THEN
      RAISE EXCEPTION 'temperature must be between 0 and 1';
    END IF;
  END IF;

  -- Validate max_tokens range (positive integer)
  IF NEW.ai_settings ? 'max_tokens' THEN
    IF (NEW.ai_settings->>'max_tokens')::integer < 1 OR
       (NEW.ai_settings->>'max_tokens')::integer > 16000 THEN
      RAISE EXCEPTION 'max_tokens must be between 1 and 16000';
    END IF;
  END IF;

  -- Validate similarity_threshold range (0 to 1)
  IF NEW.ai_settings ? 'similarity_threshold' THEN
    IF (NEW.ai_settings->>'similarity_threshold')::numeric < 0 OR
       (NEW.ai_settings->>'similarity_threshold')::numeric > 1 THEN
      RAISE EXCEPTION 'similarity_threshold must be between 0 and 1';
    END IF;
  END IF;

  -- Validate top_k_results range (1 to 20)
  IF NEW.ai_settings ? 'top_k_results' THEN
    IF (NEW.ai_settings->>'top_k_results')::integer < 1 OR
       (NEW.ai_settings->>'top_k_results')::integer > 20 THEN
      RAISE EXCEPTION 'top_k_results must be between 1 and 20';
    END IF;
  END IF;

  -- Validate model is one of supported models
  IF NEW.ai_settings ? 'model' THEN
    IF NOT (NEW.ai_settings->>'model' IN (
      'gpt-4o',
      'gpt-4o-2024-11-20',
      'gpt-4o-mini',
      'gpt-4o-mini-2024-07-18',
      'gpt-4-turbo-preview',
      'claude-3-5-sonnet-20241022'
    )) THEN
      RAISE EXCEPTION 'model must be one of: gpt-4o, gpt-4o-mini, gpt-4-turbo-preview, claude-3-5-sonnet-20241022';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate ai_settings on insert/update
DROP TRIGGER IF EXISTS validate_ai_settings_trigger ON public.companies;
CREATE TRIGGER validate_ai_settings_trigger
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION validate_ai_settings();

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: ai_settings column added to companies table';
  RAISE NOTICE 'Existing companies set to use global defaults';
  RAISE NOTICE 'Validation trigger created for ai_settings';
END $$;
