-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Employees table: Store employee information and insurance details
CREATE TABLE IF NOT EXISTS employees (
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

-- Create index for faster employee lookups
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

-- Knowledge base table: Store insurance policies, FAQs, and procedures
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500),
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL, -- 'insurance', 'claims', 'benefits', 'policy', 'faq'
  subcategory VARCHAR(100),
  embedding vector(1536), -- text-embedding-3-small dimensions
  metadata JSONB DEFAULT '{}',
  source VARCHAR(255), -- 'admin_upload', 'hitl_learning', 'initial_import'
  confidence_score DECIMAL(3, 2) DEFAULT 1.0,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for vector similarity search using HNSW (supports >2000 dimensions)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding ON knowledge_base
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON knowledge_base(is_active);

-- Chat history table: Store conversation logs
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  confidence_score DECIMAL(3, 2),
  sources JSONB DEFAULT '[]', -- Referenced knowledge base IDs
  was_escalated BOOLEAN DEFAULT false,
  escalation_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for chat history
CREATE INDEX IF NOT EXISTS idx_chat_history_conversation ON chat_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_employee ON chat_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_escalated ON chat_history(was_escalated);

-- Escalations table: Track human-in-the-loop interventions
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  message_id UUID REFERENCES chat_history(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  telegram_message_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
  resolution TEXT,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP WITH TIME ZONE,
  was_added_to_kb BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for escalations
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_conversation ON escalations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_escalations_created ON escalations(created_at DESC);

-- Employee embeddings table: Store employee data as vectors for semantic search
CREATE TABLE IF NOT EXISTS employee_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- Concatenated employee info for embedding
  embedding vector(1536), -- text-embedding-3-small dimensions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for employee vector similarity search using HNSW (supports >2000 dimensions)
CREATE INDEX IF NOT EXISTS idx_employee_embeddings_vector ON employee_embeddings
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Analytics table: Track usage metrics
CREATE TABLE IF NOT EXISTS analytics (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escalations_updated_at BEFORE UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_embeddings_updated_at BEFORE UPDATE ON employee_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only view their own data
CREATE POLICY employees_select_own ON employees
  FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

-- Policy: Employees can only view their own chat history
CREATE POLICY chat_history_select_own ON chat_history
  FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Policy: Everyone can read active knowledge base
CREATE POLICY knowledge_base_select_active ON knowledge_base
  FOR SELECT
  USING (is_active = true);

-- Function for cosine similarity search
CREATE OR REPLACE FUNCTION match_knowledge(
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
  FROM knowledge_base
  WHERE knowledge_base.is_active = true
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Function for employee data similarity search
CREATE OR REPLACE FUNCTION match_employees(
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
  FROM employee_embeddings
  WHERE 1 - (employee_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
