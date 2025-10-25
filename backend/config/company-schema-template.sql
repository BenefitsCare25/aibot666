-- ============================================
-- Company Schema Template
-- ============================================
-- This template is used to automatically create database schemas for new companies
-- Placeholder: {{SCHEMA_NAME}} will be replaced with the actual schema name
-- DO NOT modify this file unless updating the base schema structure

-- Enable pgvector extension first (must be done before using vector type)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create schema for company
CREATE SCHEMA IF NOT EXISTS {{SCHEMA_NAME}};

-- Set search path to include extensions schema for vector type
SET search_path TO {{SCHEMA_NAME}}, public, extensions;

-- ==========================================
-- TABLE DEFINITIONS
-- ==========================================

-- Employees table: Store employee information and insurance details
CREATE TABLE IF NOT EXISTS {{SCHEMA_NAME}}.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(50) UNIQUE NOT NULL,
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

-- Create indexes for faster employee lookups
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_employees_employee_id ON {{SCHEMA_NAME}}.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_employees_email ON {{SCHEMA_NAME}}.employees(email);

-- Knowledge base table: Store insurance policies, FAQs, and procedures
CREATE TABLE IF NOT EXISTS {{SCHEMA_NAME}}.knowledge_base (
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

-- Create index for vector similarity search using HNSW
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_kb_embedding ON {{SCHEMA_NAME}}.knowledge_base
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_kb_category ON {{SCHEMA_NAME}}.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_kb_active ON {{SCHEMA_NAME}}.knowledge_base(is_active);

-- Chat history table: Store conversation logs
CREATE TABLE IF NOT EXISTS {{SCHEMA_NAME}}.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  employee_id UUID REFERENCES {{SCHEMA_NAME}}.employees(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  confidence_score DECIMAL(3, 2),
  sources JSONB DEFAULT '[]',
  was_escalated BOOLEAN DEFAULT false,
  escalation_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for chat history
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_chat_conversation ON {{SCHEMA_NAME}}.chat_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_chat_employee ON {{SCHEMA_NAME}}.chat_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_chat_created ON {{SCHEMA_NAME}}.chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_chat_escalated ON {{SCHEMA_NAME}}.chat_history(was_escalated);

-- Escalations table: Track human-in-the-loop interventions
CREATE TABLE IF NOT EXISTS {{SCHEMA_NAME}}.escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  message_id UUID REFERENCES {{SCHEMA_NAME}}.chat_history(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES {{SCHEMA_NAME}}.employees(id) ON DELETE CASCADE,
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

-- Create indexes for escalations
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_esc_status ON {{SCHEMA_NAME}}.escalations(status);
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_esc_conversation ON {{SCHEMA_NAME}}.escalations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_esc_created ON {{SCHEMA_NAME}}.escalations(created_at DESC);

-- Employee embeddings table: Store employee data as vectors for semantic search
CREATE TABLE IF NOT EXISTS {{SCHEMA_NAME}}.employee_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES {{SCHEMA_NAME}}.employees(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for employee vector similarity search using HNSW
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_emp_emb_vector ON {{SCHEMA_NAME}}.employee_embeddings
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Analytics table: Track usage metrics
CREATE TABLE IF NOT EXISTS {{SCHEMA_NAME}}.analytics (
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

-- Create unique index for daily analytics
CREATE UNIQUE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_analytics_date ON {{SCHEMA_NAME}}.analytics(date);

-- ==========================================
-- TRIGGERS AND FUNCTIONS
-- ==========================================

-- Function to update updated_at timestamp (schema-specific)
CREATE OR REPLACE FUNCTION {{SCHEMA_NAME}}.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON {{SCHEMA_NAME}}.employees
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA_NAME}}.update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON {{SCHEMA_NAME}}.knowledge_base
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA_NAME}}.update_updated_at_column();

CREATE TRIGGER update_escalations_updated_at BEFORE UPDATE ON {{SCHEMA_NAME}}.escalations
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA_NAME}}.update_updated_at_column();

CREATE TRIGGER update_employee_embeddings_updated_at BEFORE UPDATE ON {{SCHEMA_NAME}}.employee_embeddings
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA_NAME}}.update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON {{SCHEMA_NAME}}.analytics
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA_NAME}}.update_updated_at_column();

-- ==========================================
-- RPC FUNCTIONS FOR VECTOR SEARCH
-- ==========================================

-- Function for cosine similarity search (schema-specific)
CREATE OR REPLACE FUNCTION {{SCHEMA_NAME}}.match_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  content TEXT,
  category VARCHAR,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    knowledge_base.id,
    knowledge_base.title,
    knowledge_base.content,
    knowledge_base.category,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM {{SCHEMA_NAME}}.knowledge_base
  WHERE knowledge_base.is_active = true
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Function for employee data similarity search (schema-specific)
CREATE OR REPLACE FUNCTION {{SCHEMA_NAME}}.match_employees(
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
  FROM {{SCHEMA_NAME}}.employee_embeddings
  WHERE 1 - (employee_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- ==========================================
-- ROW-LEVEL SECURITY POLICIES
-- ==========================================

-- Enable RLS on employees table
ALTER TABLE {{SCHEMA_NAME}}.employees ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only read their own record
CREATE POLICY "employees_select_own_record" ON {{SCHEMA_NAME}}.employees
  FOR SELECT
  USING (id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Service role can access all employees (for admin operations)
CREATE POLICY "employees_service_role_all" ON {{SCHEMA_NAME}}.employees
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- Enable RLS on chat_history table
ALTER TABLE {{SCHEMA_NAME}}.chat_history ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only access their own chat history
CREATE POLICY "chat_history_select_own_records" ON {{SCHEMA_NAME}}.chat_history
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Employees can only insert their own messages
CREATE POLICY "chat_history_insert_own_records" ON {{SCHEMA_NAME}}.chat_history
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Service role can access all chat history (for admin/analytics)
CREATE POLICY "chat_history_service_role_all" ON {{SCHEMA_NAME}}.chat_history
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- Enable RLS on escalations table
ALTER TABLE {{SCHEMA_NAME}}.escalations ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only view their own escalations
CREATE POLICY "escalations_select_own_records" ON {{SCHEMA_NAME}}.escalations
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Employees can only create escalations for themselves
CREATE POLICY "escalations_insert_own_records" ON {{SCHEMA_NAME}}.escalations
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Service role can manage all escalations (for HITL workflow)
CREATE POLICY "escalations_service_role_all" ON {{SCHEMA_NAME}}.escalations
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- Enable RLS on employee_embeddings table
ALTER TABLE {{SCHEMA_NAME}}.employee_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access embeddings (prevent direct employee access)
CREATE POLICY "employee_embeddings_service_role_only" ON {{SCHEMA_NAME}}.employee_embeddings
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- ==========================================
-- PERMISSIONS AND ACCESS GRANTS
-- ==========================================

-- Grant schema access to all Supabase roles
GRANT USAGE ON SCHEMA {{SCHEMA_NAME}} TO postgres, anon, authenticated, service_role;

-- Grant permissions on all existing tables
GRANT ALL ON ALL TABLES IN SCHEMA {{SCHEMA_NAME}} TO postgres, anon, authenticated, service_role;

-- Grant permissions on all sequences (for auto-increment IDs)
GRANT ALL ON ALL SEQUENCES IN SCHEMA {{SCHEMA_NAME}} TO postgres, anon, authenticated, service_role;

-- Grant execute permissions on all functions (RPC calls)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA {{SCHEMA_NAME}} TO postgres, anon, authenticated, service_role;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA {{SCHEMA_NAME}} GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA {{SCHEMA_NAME}} GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA {{SCHEMA_NAME}} GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- Reset search path
RESET search_path;

-- ==========================================
-- SCHEMA CREATION COMPLETE
-- ==========================================
-- Schema {{SCHEMA_NAME}} has been created with:
-- - 6 tables (employees, knowledge_base, chat_history, escalations, employee_embeddings, analytics)
-- - Vector similarity search with HNSW indexes
-- - Row-level security policies
-- - Automatic updated_at triggers
-- - Full permissions for Supabase roles
