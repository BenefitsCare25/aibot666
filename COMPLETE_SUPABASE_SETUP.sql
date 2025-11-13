-- ============================================================================
-- COMPLETE SUPABASE DATABASE SETUP - SELF-HOSTED VERSION
-- ============================================================================
-- This file contains ALL tables, functions, triggers, and policies
-- Required schemas: public, company_a, company_b, cbre
--
-- Execution order:
-- 1. Extensions
-- 2. Public schema (companies registry + activity logs)
-- 3. Company schemas (company_a, company_b, cbre)
-- 4. Row-Level Security policies
-- 5. Cross-schema access functions
-- 6. Permissions and grants
--
-- Last Updated: 2025-11-13
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 2: PUBLIC SCHEMA - COMPANY REGISTRY
-- ============================================================================

-- =====================================================
-- TABLE: public.companies
-- =====================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  additional_domains TEXT[],
  schema_name VARCHAR(63) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  log_request_email_to VARCHAR(500),
  log_request_email_cc VARCHAR(500),
  log_request_keywords TEXT[] DEFAULT ARRAY['request log', 'send logs', 'need log'],
  ai_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for companies table
CREATE INDEX IF NOT EXISTS idx_companies_domain ON public.companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_schema ON public.companies(schema_name);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_additional_domains ON public.companies USING GIN(additional_domains);
CREATE INDEX IF NOT EXISTS idx_companies_ai_settings ON public.companies USING GIN(ai_settings);

-- Comments on columns
COMMENT ON COLUMN public.companies.log_request_email_to IS 'Comma-separated list of primary support team emails for LOG requests';
COMMENT ON COLUMN public.companies.log_request_email_cc IS 'Comma-separated list of CC recipients for LOG requests';
COMMENT ON COLUMN public.companies.log_request_keywords IS 'Array of keywords that trigger LOG request mode';
COMMENT ON COLUMN public.companies.ai_settings IS 'Per-company AI configuration settings. Structure:
{
  "model": "gpt-4o",
  "temperature": 0,
  "max_tokens": 1000,
  "embedding_model": "text-embedding-3-small",
  "similarity_threshold": 0.7,
  "top_k_results": 5,
  "system_prompt": "Custom prompt...",
  "escalation_threshold": 0.5,
  "use_global_defaults": true
}';

-- =====================================================
-- FUNCTIONS: Company registry helpers
-- =====================================================

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

-- Function to validate schema name
CREATE OR REPLACE FUNCTION validate_schema_name(schema_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF schema_name !~ '^[a-z_][a-z0-9_]*$' OR length(schema_name) > 63 THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get company by domain
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

-- Function to validate ai_settings
CREATE OR REPLACE FUNCTION validate_ai_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ai_settings IS NOT NULL AND jsonb_typeof(NEW.ai_settings) != 'object' THEN
    RAISE EXCEPTION 'ai_settings must be a JSON object';
  END IF;

  IF NEW.ai_settings ? 'temperature' THEN
    IF (NEW.ai_settings->>'temperature')::numeric < 0 OR
       (NEW.ai_settings->>'temperature')::numeric > 1 THEN
      RAISE EXCEPTION 'temperature must be between 0 and 1';
    END IF;
  END IF;

  IF NEW.ai_settings ? 'max_tokens' THEN
    IF (NEW.ai_settings->>'max_tokens')::integer < 1 OR
       (NEW.ai_settings->>'max_tokens')::integer > 16000 THEN
      RAISE EXCEPTION 'max_tokens must be between 1 and 16000';
    END IF;
  END IF;

  IF NEW.ai_settings ? 'similarity_threshold' THEN
    IF (NEW.ai_settings->>'similarity_threshold')::numeric < 0 OR
       (NEW.ai_settings->>'similarity_threshold')::numeric > 1 THEN
      RAISE EXCEPTION 'similarity_threshold must be between 0 and 1';
    END IF;
  END IF;

  IF NEW.ai_settings ? 'top_k_results' THEN
    IF (NEW.ai_settings->>'top_k_results')::integer < 1 OR
       (NEW.ai_settings->>'top_k_results')::integer > 20 THEN
      RAISE EXCEPTION 'top_k_results must be between 1 and 20';
    END IF;
  END IF;

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

-- Trigger to validate ai_settings
DROP TRIGGER IF EXISTS validate_ai_settings_trigger ON public.companies;
CREATE TRIGGER validate_ai_settings_trigger
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION validate_ai_settings();

-- =====================================================
-- TABLE: public.schema_activity_logs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.schema_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL CHECK (action IN ('create_schema', 'delete_schema', 'rollback_creation')),
  schema_name VARCHAR(63) NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  admin_user VARCHAR(255),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for schema_activity_logs
CREATE INDEX IF NOT EXISTS idx_schema_logs_schema_name ON public.schema_activity_logs(schema_name);
CREATE INDEX IF NOT EXISTS idx_schema_logs_company_id ON public.schema_activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_schema_logs_action ON public.schema_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_schema_logs_status ON public.schema_activity_logs(status);
CREATE INDEX IF NOT EXISTS idx_schema_logs_created_at ON public.schema_activity_logs(created_at DESC);

-- =====================================================
-- FUNCTIONS: Schema activity logs helpers
-- =====================================================

CREATE OR REPLACE FUNCTION get_schema_activity_by_company(company_uuid UUID)
RETURNS TABLE (
  log_id UUID,
  action VARCHAR,
  schema_name VARCHAR,
  admin_user VARCHAR,
  status VARCHAR,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.action,
    l.schema_name,
    l.admin_user,
    l.status,
    l.error_message,
    l.created_at,
    l.completed_at
  FROM public.schema_activity_logs l
  WHERE l.company_id = company_uuid
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_failed_schema_operations(days_ago INTEGER DEFAULT 7)
RETURNS TABLE (
  log_id UUID,
  action VARCHAR,
  schema_name VARCHAR,
  company_id UUID,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.action,
    l.schema_name,
    l.company_id,
    l.error_message,
    l.created_at
  FROM public.schema_activity_logs l
  WHERE
    l.status = 'failed' AND
    l.created_at >= NOW() - (days_ago || ' days')::INTERVAL
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW-LEVEL SECURITY: Public schema
-- =====================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_admin_all ON public.companies FOR ALL USING (true);

ALTER TABLE public.schema_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY schema_logs_admin_all ON public.schema_activity_logs FOR ALL USING (true);

-- =====================================================
-- INSERT: Initial company data
-- =====================================================

INSERT INTO public.companies (name, domain, additional_domains, schema_name, status, settings, ai_settings)
VALUES
  (
    'Company A',
    'company-a.local',
    ARRAY['www.company-a.local', 'localhost'],
    'company_a',
    'active',
    '{"brandColor": "#3b82f6", "features": ["escalation", "analytics"]}'::JSONB,
    jsonb_build_object(
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
  ),
  (
    'Company B',
    'company-b.local',
    ARRAY['www.company-b.local'],
    'company_b',
    'active',
    '{"brandColor": "#10b981", "features": ["escalation", "analytics"]}'::JSONB,
    jsonb_build_object(
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
  ),
  (
    'CBRE',
    'https://benefits.inspro.com.sg/CBRE',
    ARRAY['www.benefits.inspro.com.sg/CBRE', 'localhost/CBRE', 'benefits.inspro.com.sg/CBRE'],
    'cbre',
    'active',
    '{"brandColor": "#0066cc", "features": ["escalation", "analytics", "quick_questions"]}'::JSONB,
    jsonb_build_object(
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
  )
ON CONFLICT (domain) DO NOTHING;

-- ============================================================================
-- STEP 3: COMPANY SCHEMAS - COMPANY_A
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS company_a;
SET search_path TO company_a, public, extensions;

-- =====================================================
-- TABLE: company_a.employees
-- =====================================================
CREATE TABLE IF NOT EXISTS company_a.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  department VARCHAR(100),
  policy_type VARCHAR(100) NOT NULL,
  coverage_limit DECIMAL(12, 2),
  annual_claim_limit DECIMAL(12, 2),
  outpatient_limit DECIMAL(12, 2),
  dental_limit DECIMAL(12, 2),
  optical_limit DECIMAL(12, 2),
  policy_start_date DATE,
  policy_end_date DATE,
  dependents JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_a_employees_employee_id ON company_a.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_company_a_employees_email ON company_a.employees(email);
CREATE INDEX IF NOT EXISTS idx_company_a_employees_user_id ON company_a.employees(user_id);

-- =====================================================
-- TABLE: company_a.knowledge_base
-- =====================================================
CREATE TABLE IF NOT EXISTS company_a.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500),
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  source VARCHAR(255),
  confidence_score DECIMAL(3, 2) DEFAULT 1.0,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_a_kb_embedding ON company_a.knowledge_base
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_company_a_kb_category ON company_a.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_company_a_kb_active ON company_a.knowledge_base(is_active);

-- =====================================================
-- TABLE: company_a.chat_history
-- =====================================================
CREATE TABLE IF NOT EXISTS company_a.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  employee_id UUID REFERENCES company_a.employees(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  confidence_score DECIMAL(3, 2),
  sources JSONB DEFAULT '[]',
  was_escalated BOOLEAN DEFAULT false,
  escalation_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attended_by VARCHAR(255),
  admin_notes TEXT,
  attended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_company_a_chat_conversation ON company_a.chat_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_company_a_chat_employee ON company_a.chat_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_company_a_chat_created ON company_a.chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_a_chat_escalated ON company_a.chat_history(was_escalated);
CREATE INDEX IF NOT EXISTS idx_company_a_chat_attended ON company_a.chat_history(attended_by) WHERE attended_by IS NOT NULL;

-- =====================================================
-- TABLE: company_a.escalations
-- =====================================================
CREATE TABLE IF NOT EXISTS company_a.escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  message_id UUID REFERENCES company_a.chat_history(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES company_a.employees(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  telegram_message_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  resolution TEXT,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP WITH TIME ZONE,
  was_added_to_kb BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_a_esc_status ON company_a.escalations(status);
CREATE INDEX IF NOT EXISTS idx_company_a_esc_conversation ON company_a.escalations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_company_a_esc_created ON company_a.escalations(created_at DESC);

-- =====================================================
-- TABLE: company_a.employee_embeddings
-- =====================================================
CREATE TABLE IF NOT EXISTS company_a.employee_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES company_a.employees(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_a_emp_emb_vector ON company_a.employee_embeddings
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- =====================================================
-- TABLE: company_a.analytics
-- =====================================================
CREATE TABLE IF NOT EXISTS company_a.analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_queries INTEGER DEFAULT 0,
  successful_queries INTEGER DEFAULT 0,
  escalated_queries INTEGER DEFAULT 0,
  avg_confidence_score DECIMAL(3, 2),
  avg_response_time_ms INTEGER,
  unique_users INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_a_analytics_date ON company_a.analytics(date);

-- =====================================================
-- TABLE: company_a.quick_questions
-- =====================================================
CREATE TABLE IF NOT EXISTS company_a.quick_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR(100) NOT NULL,
  category_title VARCHAR(255) NOT NULL,
  category_icon VARCHAR(50) DEFAULT 'question',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_a_qq_category ON company_a.quick_questions(category_id);
CREATE INDEX IF NOT EXISTS idx_company_a_qq_active ON company_a.quick_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_company_a_qq_order ON company_a.quick_questions(category_id, display_order);

-- =====================================================
-- TABLE: company_a.log_requests
-- =====================================================
CREATE TABLE IF NOT EXISTS company_a.log_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  employee_id UUID REFERENCES company_a.employees(id) ON DELETE SET NULL,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('keyword', 'button')),
  request_message TEXT,
  user_email VARCHAR(255),
  acknowledgment_sent BOOLEAN DEFAULT false,
  acknowledgment_sent_at TIMESTAMP WITH TIME ZONE,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_error TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_a_log_requests_conversation ON company_a.log_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_company_a_log_requests_employee ON company_a.log_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_company_a_log_requests_created ON company_a.log_requests(created_at DESC);

COMMENT ON TABLE company_a.log_requests IS 'Stores LOG (conversation history + attachments) requests sent to support team via email';

-- =====================================================
-- FUNCTIONS: company_a helpers
-- =====================================================

CREATE OR REPLACE FUNCTION company_a.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON company_a.employees
  FOR EACH ROW EXECUTE FUNCTION company_a.update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON company_a.knowledge_base
  FOR EACH ROW EXECUTE FUNCTION company_a.update_updated_at_column();

CREATE TRIGGER update_escalations_updated_at BEFORE UPDATE ON company_a.escalations
  FOR EACH ROW EXECUTE FUNCTION company_a.update_updated_at_column();

CREATE TRIGGER update_employee_embeddings_updated_at BEFORE UPDATE ON company_a.employee_embeddings
  FOR EACH ROW EXECUTE FUNCTION company_a.update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON company_a.analytics
  FOR EACH ROW EXECUTE FUNCTION company_a.update_updated_at_column();

CREATE TRIGGER update_quick_questions_updated_at BEFORE UPDATE ON company_a.quick_questions
  FOR EACH ROW EXECUTE FUNCTION company_a.update_updated_at_column();

CREATE TRIGGER update_log_requests_updated_at BEFORE UPDATE ON company_a.log_requests
  FOR EACH ROW EXECUTE FUNCTION company_a.update_updated_at_column();

-- Vector search function (with subcategory for policy filtering)
CREATE OR REPLACE FUNCTION company_a.match_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  content TEXT,
  category VARCHAR,
  subcategory VARCHAR,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    knowledge_base.id,
    knowledge_base.title,
    knowledge_base.content,
    knowledge_base.category,
    knowledge_base.subcategory,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM company_a.knowledge_base
  WHERE knowledge_base.is_active = true
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Employee vector search function
CREATE OR REPLACE FUNCTION company_a.match_employees(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  content TEXT,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    employee_embeddings.id,
    employee_embeddings.employee_id,
    employee_embeddings.content,
    1 - (employee_embeddings.embedding <=> query_embedding) as similarity
  FROM company_a.employee_embeddings
  WHERE 1 - (employee_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

RESET search_path;

-- ============================================================================
-- STEP 4: COMPANY SCHEMAS - COMPANY_B
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS company_b;
SET search_path TO company_b, public, extensions;

-- =====================================================
-- TABLE: company_b.employees
-- =====================================================
CREATE TABLE IF NOT EXISTS company_b.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  department VARCHAR(100),
  policy_type VARCHAR(100) NOT NULL,
  coverage_limit DECIMAL(12, 2),
  annual_claim_limit DECIMAL(12, 2),
  outpatient_limit DECIMAL(12, 2),
  dental_limit DECIMAL(12, 2),
  optical_limit DECIMAL(12, 2),
  policy_start_date DATE,
  policy_end_date DATE,
  dependents JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_b_employees_employee_id ON company_b.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_company_b_employees_email ON company_b.employees(email);
CREATE INDEX IF NOT EXISTS idx_company_b_employees_user_id ON company_b.employees(user_id);

-- =====================================================
-- TABLE: company_b.knowledge_base
-- =====================================================
CREATE TABLE IF NOT EXISTS company_b.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500),
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  source VARCHAR(255),
  confidence_score DECIMAL(3, 2) DEFAULT 1.0,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_b_kb_embedding ON company_b.knowledge_base
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_company_b_kb_category ON company_b.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_company_b_kb_active ON company_b.knowledge_base(is_active);

-- =====================================================
-- TABLE: company_b.chat_history
-- =====================================================
CREATE TABLE IF NOT EXISTS company_b.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  employee_id UUID REFERENCES company_b.employees(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  confidence_score DECIMAL(3, 2),
  sources JSONB DEFAULT '[]',
  was_escalated BOOLEAN DEFAULT false,
  escalation_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attended_by VARCHAR(255),
  admin_notes TEXT,
  attended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_company_b_chat_conversation ON company_b.chat_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_company_b_chat_employee ON company_b.chat_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_company_b_chat_created ON company_b.chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_b_chat_escalated ON company_b.chat_history(was_escalated);
CREATE INDEX IF NOT EXISTS idx_company_b_chat_attended ON company_b.chat_history(attended_by) WHERE attended_by IS NOT NULL;

-- =====================================================
-- TABLE: company_b.escalations
-- =====================================================
CREATE TABLE IF NOT EXISTS company_b.escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  message_id UUID REFERENCES company_b.chat_history(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES company_b.employees(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  telegram_message_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  resolution TEXT,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP WITH TIME ZONE,
  was_added_to_kb BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_b_esc_status ON company_b.escalations(status);
CREATE INDEX IF NOT EXISTS idx_company_b_esc_conversation ON company_b.escalations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_company_b_esc_created ON company_b.escalations(created_at DESC);

-- =====================================================
-- TABLE: company_b.employee_embeddings
-- =====================================================
CREATE TABLE IF NOT EXISTS company_b.employee_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES company_b.employees(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_b_emp_emb_vector ON company_b.employee_embeddings
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- =====================================================
-- TABLE: company_b.analytics
-- =====================================================
CREATE TABLE IF NOT EXISTS company_b.analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_queries INTEGER DEFAULT 0,
  successful_queries INTEGER DEFAULT 0,
  escalated_queries INTEGER DEFAULT 0,
  avg_confidence_score DECIMAL(3, 2),
  avg_response_time_ms INTEGER,
  unique_users INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_b_analytics_date ON company_b.analytics(date);

-- =====================================================
-- TABLE: company_b.quick_questions
-- =====================================================
CREATE TABLE IF NOT EXISTS company_b.quick_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR(100) NOT NULL,
  category_title VARCHAR(255) NOT NULL,
  category_icon VARCHAR(50) DEFAULT 'question',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_b_qq_category ON company_b.quick_questions(category_id);
CREATE INDEX IF NOT EXISTS idx_company_b_qq_active ON company_b.quick_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_company_b_qq_order ON company_b.quick_questions(category_id, display_order);

-- =====================================================
-- TABLE: company_b.log_requests
-- =====================================================
CREATE TABLE IF NOT EXISTS company_b.log_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  employee_id UUID REFERENCES company_b.employees(id) ON DELETE SET NULL,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('keyword', 'button')),
  request_message TEXT,
  user_email VARCHAR(255),
  acknowledgment_sent BOOLEAN DEFAULT false,
  acknowledgment_sent_at TIMESTAMP WITH TIME ZONE,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_error TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_b_log_requests_conversation ON company_b.log_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_company_b_log_requests_employee ON company_b.log_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_company_b_log_requests_created ON company_b.log_requests(created_at DESC);

COMMENT ON TABLE company_b.log_requests IS 'Stores LOG (conversation history + attachments) requests sent to support team via email';

-- =====================================================
-- FUNCTIONS: company_b helpers
-- =====================================================

CREATE OR REPLACE FUNCTION company_b.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON company_b.employees
  FOR EACH ROW EXECUTE FUNCTION company_b.update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON company_b.knowledge_base
  FOR EACH ROW EXECUTE FUNCTION company_b.update_updated_at_column();

CREATE TRIGGER update_escalations_updated_at BEFORE UPDATE ON company_b.escalations
  FOR EACH ROW EXECUTE FUNCTION company_b.update_updated_at_column();

CREATE TRIGGER update_employee_embeddings_updated_at BEFORE UPDATE ON company_b.employee_embeddings
  FOR EACH ROW EXECUTE FUNCTION company_b.update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON company_b.analytics
  FOR EACH ROW EXECUTE FUNCTION company_b.update_updated_at_column();

CREATE TRIGGER update_quick_questions_updated_at BEFORE UPDATE ON company_b.quick_questions
  FOR EACH ROW EXECUTE FUNCTION company_b.update_updated_at_column();

CREATE TRIGGER update_log_requests_updated_at BEFORE UPDATE ON company_b.log_requests
  FOR EACH ROW EXECUTE FUNCTION company_b.update_updated_at_column();

-- Vector search function (with subcategory for policy filtering)
CREATE OR REPLACE FUNCTION company_b.match_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  content TEXT,
  category VARCHAR,
  subcategory VARCHAR,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    knowledge_base.id,
    knowledge_base.title,
    knowledge_base.content,
    knowledge_base.category,
    knowledge_base.subcategory,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM company_b.knowledge_base
  WHERE knowledge_base.is_active = true
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Employee vector search function
CREATE OR REPLACE FUNCTION company_b.match_employees(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  content TEXT,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    employee_embeddings.id,
    employee_embeddings.employee_id,
    employee_embeddings.content,
    1 - (employee_embeddings.embedding <=> query_embedding) as similarity
  FROM company_b.employee_embeddings
  WHERE 1 - (employee_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

RESET search_path;

-- ============================================================================
-- STEP 5: COMPANY SCHEMAS - CBRE
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS cbre;
SET search_path TO cbre, public, extensions;

-- =====================================================
-- TABLE: cbre.employees
-- =====================================================
CREATE TABLE IF NOT EXISTS cbre.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  department VARCHAR(100),
  policy_type VARCHAR(100) NOT NULL,
  coverage_limit DECIMAL(12, 2),
  annual_claim_limit DECIMAL(12, 2),
  outpatient_limit DECIMAL(12, 2),
  dental_limit DECIMAL(12, 2),
  optical_limit DECIMAL(12, 2),
  policy_start_date DATE,
  policy_end_date DATE,
  dependents JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbre_employees_employee_id ON cbre.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_cbre_employees_email ON cbre.employees(email);
CREATE INDEX IF NOT EXISTS idx_cbre_employees_user_id ON cbre.employees(user_id);

-- =====================================================
-- TABLE: cbre.knowledge_base
-- =====================================================
CREATE TABLE IF NOT EXISTS cbre.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500),
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  source VARCHAR(255),
  confidence_score DECIMAL(3, 2) DEFAULT 1.0,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbre_kb_embedding ON cbre.knowledge_base
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_cbre_kb_category ON cbre.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_cbre_kb_active ON cbre.knowledge_base(is_active);

-- =====================================================
-- TABLE: cbre.chat_history
-- =====================================================
CREATE TABLE IF NOT EXISTS cbre.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  employee_id UUID REFERENCES cbre.employees(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  confidence_score DECIMAL(3, 2),
  sources JSONB DEFAULT '[]',
  was_escalated BOOLEAN DEFAULT false,
  escalation_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attended_by VARCHAR(255),
  admin_notes TEXT,
  attended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_cbre_chat_conversation ON cbre.chat_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_cbre_chat_employee ON cbre.chat_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_cbre_chat_created ON cbre.chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbre_chat_escalated ON cbre.chat_history(was_escalated);
CREATE INDEX IF NOT EXISTS idx_cbre_chat_attended ON cbre.chat_history(attended_by) WHERE attended_by IS NOT NULL;

-- =====================================================
-- TABLE: cbre.escalations
-- =====================================================
CREATE TABLE IF NOT EXISTS cbre.escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  message_id UUID REFERENCES cbre.chat_history(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES cbre.employees(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  telegram_message_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  resolution TEXT,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP WITH TIME ZONE,
  was_added_to_kb BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbre_esc_status ON cbre.escalations(status);
CREATE INDEX IF NOT EXISTS idx_cbre_esc_conversation ON cbre.escalations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_cbre_esc_created ON cbre.escalations(created_at DESC);

-- =====================================================
-- TABLE: cbre.employee_embeddings
-- =====================================================
CREATE TABLE IF NOT EXISTS cbre.employee_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES cbre.employees(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbre_emp_emb_vector ON cbre.employee_embeddings
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- =====================================================
-- TABLE: cbre.analytics
-- =====================================================
CREATE TABLE IF NOT EXISTS cbre.analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_queries INTEGER DEFAULT 0,
  successful_queries INTEGER DEFAULT 0,
  escalated_queries INTEGER DEFAULT 0,
  avg_confidence_score DECIMAL(3, 2),
  avg_response_time_ms INTEGER,
  unique_users INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cbre_analytics_date ON cbre.analytics(date);

-- =====================================================
-- TABLE: cbre.quick_questions
-- =====================================================
CREATE TABLE IF NOT EXISTS cbre.quick_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR(100) NOT NULL,
  category_title VARCHAR(255) NOT NULL,
  category_icon VARCHAR(50) DEFAULT 'question',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbre_qq_category ON cbre.quick_questions(category_id);
CREATE INDEX IF NOT EXISTS idx_cbre_qq_active ON cbre.quick_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_cbre_qq_order ON cbre.quick_questions(category_id, display_order);

-- =====================================================
-- TABLE: cbre.log_requests
-- =====================================================
CREATE TABLE IF NOT EXISTS cbre.log_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  employee_id UUID REFERENCES cbre.employees(id) ON DELETE SET NULL,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('keyword', 'button')),
  request_message TEXT,
  user_email VARCHAR(255),
  acknowledgment_sent BOOLEAN DEFAULT false,
  acknowledgment_sent_at TIMESTAMP WITH TIME ZONE,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_error TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbre_log_requests_conversation ON cbre.log_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_cbre_log_requests_employee ON cbre.log_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_cbre_log_requests_created ON cbre.log_requests(created_at DESC);

COMMENT ON TABLE cbre.log_requests IS 'Stores LOG (conversation history + attachments) requests sent to support team via email';

-- =====================================================
-- FUNCTIONS: cbre helpers
-- =====================================================

CREATE OR REPLACE FUNCTION cbre.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON cbre.employees
  FOR EACH ROW EXECUTE FUNCTION cbre.update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON cbre.knowledge_base
  FOR EACH ROW EXECUTE FUNCTION cbre.update_updated_at_column();

CREATE TRIGGER update_escalations_updated_at BEFORE UPDATE ON cbre.escalations
  FOR EACH ROW EXECUTE FUNCTION cbre.update_updated_at_column();

CREATE TRIGGER update_employee_embeddings_updated_at BEFORE UPDATE ON cbre.employee_embeddings
  FOR EACH ROW EXECUTE FUNCTION cbre.update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON cbre.analytics
  FOR EACH ROW EXECUTE FUNCTION cbre.update_updated_at_column();

CREATE TRIGGER update_quick_questions_updated_at BEFORE UPDATE ON cbre.quick_questions
  FOR EACH ROW EXECUTE FUNCTION cbre.update_updated_at_column();

CREATE TRIGGER update_log_requests_updated_at BEFORE UPDATE ON cbre.log_requests
  FOR EACH ROW EXECUTE FUNCTION cbre.update_updated_at_column();

-- Vector search function (with subcategory for policy filtering)
CREATE OR REPLACE FUNCTION cbre.match_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  content TEXT,
  category VARCHAR,
  subcategory VARCHAR,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    knowledge_base.id,
    knowledge_base.title,
    knowledge_base.content,
    knowledge_base.category,
    knowledge_base.subcategory,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM cbre.knowledge_base
  WHERE knowledge_base.is_active = true
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Employee vector search function
CREATE OR REPLACE FUNCTION cbre.match_employees(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  content TEXT,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    employee_embeddings.id,
    employee_embeddings.employee_id,
    employee_embeddings.content,
    1 - (employee_embeddings.embedding <=> query_embedding) as similarity
  FROM cbre.employee_embeddings
  WHERE 1 - (employee_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

RESET search_path;

-- ============================================================================
-- STEP 6: ROW-LEVEL SECURITY POLICIES
-- ============================================================================

-- =====================================================
-- RLS: company_a
-- =====================================================

ALTER TABLE company_a.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_select_own_record" ON company_a.employees
  FOR SELECT
  USING (id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "employees_service_role_all" ON company_a.employees
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE company_a.chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_history_select_own_records" ON company_a.chat_history
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "chat_history_insert_own_records" ON company_a.chat_history
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "chat_history_service_role_all" ON company_a.chat_history
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE company_a.escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escalations_select_own_records" ON company_a.escalations
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "escalations_insert_own_records" ON company_a.escalations
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "escalations_service_role_all" ON company_a.escalations
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE company_a.employee_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_embeddings_service_role_only" ON company_a.employee_embeddings
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE company_a.log_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_requests_service_role_all" ON company_a.log_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- RLS: company_b
-- =====================================================

ALTER TABLE company_b.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_select_own_record" ON company_b.employees
  FOR SELECT
  USING (id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "employees_service_role_all" ON company_b.employees
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE company_b.chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_history_select_own_records" ON company_b.chat_history
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "chat_history_insert_own_records" ON company_b.chat_history
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "chat_history_service_role_all" ON company_b.chat_history
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE company_b.escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escalations_select_own_records" ON company_b.escalations
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "escalations_insert_own_records" ON company_b.escalations
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "escalations_service_role_all" ON company_b.escalations
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE company_b.employee_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_embeddings_service_role_only" ON company_b.employee_embeddings
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE company_b.log_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_requests_service_role_all" ON company_b.log_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- RLS: cbre
-- =====================================================

ALTER TABLE cbre.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_select_own_record" ON cbre.employees
  FOR SELECT
  USING (id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "employees_service_role_all" ON cbre.employees
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE cbre.chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_history_select_own_records" ON cbre.chat_history
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "chat_history_insert_own_records" ON cbre.chat_history
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "chat_history_service_role_all" ON cbre.chat_history
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE cbre.escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escalations_select_own_records" ON cbre.escalations
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "escalations_insert_own_records" ON cbre.escalations
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);
CREATE POLICY "escalations_service_role_all" ON cbre.escalations
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE cbre.employee_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_embeddings_service_role_only" ON cbre.employee_embeddings
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

ALTER TABLE cbre.log_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_requests_service_role_all" ON cbre.log_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 7: CROSS-SCHEMA ACCESS FUNCTIONS
-- ============================================================================
-- These functions allow querying any schema dynamically without exposing all schemas

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.get_quick_questions_by_schema(TEXT);
DROP FUNCTION IF EXISTS public.get_all_quick_questions_by_schema(TEXT);
DROP FUNCTION IF EXISTS public.insert_quick_question(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS public.delete_all_quick_questions(TEXT);

-- Function to get active quick questions from any schema
CREATE OR REPLACE FUNCTION public.get_quick_questions_by_schema(schema_name TEXT)
RETURNS TABLE (
    id UUID,
    category_id VARCHAR(100),
    category_title VARCHAR(255),
    category_icon VARCHAR(50),
    question TEXT,
    answer TEXT,
    display_order INTEGER,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    IF schema_name !~ '^[a-z_][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid schema name';
    END IF;

    RETURN QUERY EXECUTE format(
        'SELECT id, category_id, category_title, category_icon, question, answer,
                display_order, is_active, created_at, updated_at
         FROM %I.quick_questions
         WHERE is_active = true
         ORDER BY category_id, display_order',
        schema_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_quick_questions_by_schema(TEXT) TO postgres, anon, authenticated, service_role;

-- Function to get all quick questions (including inactive)
CREATE OR REPLACE FUNCTION public.get_all_quick_questions_by_schema(schema_name TEXT)
RETURNS TABLE (
    id UUID,
    category_id VARCHAR(100),
    category_title VARCHAR(255),
    category_icon VARCHAR(50),
    question TEXT,
    answer TEXT,
    display_order INTEGER,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    IF schema_name !~ '^[a-z_][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid schema name';
    END IF;

    RETURN QUERY EXECUTE format(
        'SELECT id, category_id, category_title, category_icon, question, answer,
                display_order, is_active, created_at, updated_at
         FROM %I.quick_questions
         ORDER BY category_id, display_order',
        schema_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_all_quick_questions_by_schema(TEXT) TO postgres, anon, authenticated, service_role;

-- Function to insert quick question
CREATE OR REPLACE FUNCTION public.insert_quick_question(
    schema_name TEXT,
    p_category_id TEXT,
    p_category_title TEXT,
    p_category_icon TEXT,
    p_question TEXT,
    p_answer TEXT,
    p_display_order INTEGER,
    p_is_active BOOLEAN
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    IF schema_name !~ '^[a-z_][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid schema name';
    END IF;

    EXECUTE format(
        'INSERT INTO %I.quick_questions
         (category_id, category_title, category_icon, question, answer, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id',
        schema_name
    ) INTO new_id
    USING p_category_id, p_category_title, p_category_icon, p_question, p_answer, p_display_order, p_is_active;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.insert_quick_question(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN) TO postgres, anon, authenticated, service_role;

-- Function to delete all quick questions
CREATE OR REPLACE FUNCTION public.delete_all_quick_questions(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
    IF schema_name !~ '^[a-z_][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid schema name';
    END IF;

    EXECUTE format('DELETE FROM %I.quick_questions WHERE id IS NOT NULL', schema_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_all_quick_questions(TEXT) TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- STEP 8: PERMISSIONS AND GRANTS
-- ============================================================================

-- Grant schema access to all Supabase roles
GRANT USAGE ON SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA company_b TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA cbre TO postgres, anon, authenticated, service_role;

-- Grant permissions on all existing tables
GRANT ALL ON ALL TABLES IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA company_b TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA cbre TO postgres, anon, authenticated, service_role;

-- Grant permissions on all sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA company_b TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA cbre TO postgres, anon, authenticated, service_role;

-- Grant execute permissions on all functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA company_b TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cbre TO postgres, anon, authenticated, service_role;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA company_a GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA company_b GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cbre GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA company_a GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA company_b GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cbre GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA company_a GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA company_b GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cbre GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

-- Verification queries (uncomment to run):
-- SELECT id, name, domain, schema_name, status FROM public.companies;
-- SELECT tablename FROM pg_tables WHERE schemaname = 'company_a' ORDER BY tablename;
-- SELECT tablename FROM pg_tables WHERE schemaname = 'company_b' ORDER BY tablename;
-- SELECT tablename FROM pg_tables WHERE schemaname = 'cbre' ORDER BY tablename;
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'company_a' AND routine_type = 'FUNCTION';
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'company_b' AND routine_type = 'FUNCTION';
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'cbre' AND routine_type = 'FUNCTION';
