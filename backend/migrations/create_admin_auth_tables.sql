-- Migration: Create Admin Authentication Tables
-- Description: Creates admin_users and admin_sessions tables for secure admin authentication
-- Date: 2025-11-14

-- Create admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin')),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin_sessions table
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin_audit_logs table for security tracking
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON public.admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user_id ON public.admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON public.admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id ON public.admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_users_updated_at();

-- Insert initial Super Admin account
-- Default credentials: username=admin, password=Admin123!
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO public.admin_users (username, password_hash, role, full_name, email)
VALUES (
    'admin',
    '$2a$10$rQZ8vJZ9XZqN5xGx5xGx5.xGx5xGx5xGx5xGx5xGx5xGx5xGx5xGx',  -- This will be replaced by setup script
    'super_admin',
    'Super Administrator',
    'admin@example.com'
) ON CONFLICT (username) DO NOTHING;

-- Grant necessary permissions (if using RLS)
-- ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE public.admin_users IS 'Stores admin user accounts with authentication credentials';
COMMENT ON TABLE public.admin_sessions IS 'Tracks active admin sessions with JWT tokens';
COMMENT ON TABLE public.admin_audit_logs IS 'Audit trail for admin actions';
COMMENT ON COLUMN public.admin_users.role IS 'Admin role: super_admin (full access) or admin (limited access)';
COMMENT ON COLUMN public.admin_users.password_hash IS 'Bcrypt hash of admin password (salt rounds: 10)';
