-- Company B Schema
-- Creates complete database schema for Company B with all tables

-- Enable pgvector extension first (must be done before using vector type)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create schema for company
CREATE SCHEMA IF NOT EXISTS company_b;

-- Set search path to include extensions schema for vector type
SET search_path TO company_b, public, extensions;

-- Employees table: Store employee information for chatbot access verification
-- Note: Policy data is NOT stored here for security reasons
-- Employees access policy information through their dedicated employee portal
CREATE TABLE IF NOT EXISTS company_b.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  deactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  deactivated_by VARCHAR(255) DEFAULT NULL,
  deactivation_reason TEXT DEFAULT NULL
);

-- Create indexes for faster employee lookups
CREATE INDEX IF NOT EXISTS idx_company_b_employees_employee_id ON company_b.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_company_b_employees_email ON company_b.employees(email);
CREATE INDEX IF NOT EXISTS idx_company_b_employees_user_id ON company_b.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_company_b_employees_is_active ON company_b.employees(is_active);

-- Knowledge base table: Store insurance policies, FAQs, and procedures
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

-- Create index for vector similarity search using HNSW
CREATE INDEX IF NOT EXISTS idx_company_b_kb_embedding ON company_b.knowledge_base
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_company_b_kb_category ON company_b.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_company_b_kb_active ON company_b.knowledge_base(is_active);

-- Chat history table: Store conversation logs
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for chat history
CREATE INDEX IF NOT EXISTS idx_company_b_chat_conversation ON company_b.chat_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_company_b_chat_employee ON company_b.chat_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_company_b_chat_created ON company_b.chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_b_chat_escalated ON company_b.chat_history(was_escalated);

-- Escalations table: Track human-in-the-loop interventions
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

-- Create indexes for escalations
CREATE INDEX IF NOT EXISTS idx_company_b_esc_status ON company_b.escalations(status);
CREATE INDEX IF NOT EXISTS idx_company_b_esc_conversation ON company_b.escalations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_company_b_esc_created ON company_b.escalations(created_at DESC);

-- Employee embeddings table: Store employee data as vectors for semantic search
CREATE TABLE IF NOT EXISTS company_b.employee_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES company_b.employees(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for employee vector similarity search using HNSW
CREATE INDEX IF NOT EXISTS idx_company_b_emp_emb_vector ON company_b.employee_embeddings
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Analytics table: Track usage metrics
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

-- Create unique index for daily analytics
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_b_analytics_date ON company_b.analytics(date);

-- Function to update updated_at timestamp (schema-specific)
CREATE OR REPLACE FUNCTION company_b.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
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

-- Function for cosine similarity search (schema-specific)
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
  FROM company_b.knowledge_base
  WHERE knowledge_base.is_active = true
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Function for employee data similarity search (schema-specific)
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

-- Grant permissions (adjust based on your security requirements)
-- GRANT USAGE ON SCHEMA company_b TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA company_b TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA company_b TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA company_b TO your_app_user;

-- Reset search path
RESET search_path;
