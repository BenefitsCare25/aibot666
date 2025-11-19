-- ============================================================================
-- RBAC (Role-Based Access Control) System Migration
-- Created: 2025-01-19
-- Purpose: Add comprehensive role and permission management system
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Roles Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false, -- true for "Super Admin" role (cannot be deleted)
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_roles_is_system ON public.roles(is_system);
CREATE INDEX idx_roles_created_by ON public.roles(created_by);

-- ============================================================================
-- STEP 2: Create Permissions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL, -- e.g., "employees.view"
  resource VARCHAR(50) NOT NULL, -- e.g., "employees"
  action VARCHAR(50) NOT NULL, -- e.g., "view"
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster permission checks
CREATE INDEX idx_permissions_code ON public.permissions(code);
CREATE INDEX idx_permissions_resource ON public.permissions(resource);
CREATE INDEX idx_permissions_resource_action ON public.permissions(resource, action);

-- ============================================================================
-- STEP 3: Create Role-Permission Mapping Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Indexes for faster permission lookups
CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions(permission_id);

-- ============================================================================
-- STEP 4: Add role_id to admin_users table
-- ============================================================================
-- Add new role_id column (nullable for migration)
ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_role_id ON public.admin_users(role_id);

-- Note: Keep existing 'role' column temporarily for backward compatibility
-- It will be removed in a future migration after full testing

-- ============================================================================
-- STEP 5: Seed Default Permissions (47 permissions across 10 modules)
-- ============================================================================

-- Dashboard Permissions
INSERT INTO public.permissions (code, resource, action, description) VALUES
('dashboard.view', 'dashboard', 'view', 'View dashboard and analytics'),
('dashboard.export', 'dashboard', 'export', 'Export dashboard data');

-- Employee Permissions
INSERT INTO public.permissions (code, resource, action, description) VALUES
('employees.view', 'employees', 'view', 'View employee list'),
('employees.create', 'employees', 'create', 'Add new employees'),
('employees.edit', 'employees', 'edit', 'Edit employee details'),
('employees.delete', 'employees', 'delete', 'Delete/deactivate employees'),
('employees.upload', 'employees', 'upload', 'Bulk upload employees (Excel)'),
('employees.export', 'employees', 'export', 'Export employee data');

-- Knowledge Base Permissions
INSERT INTO public.permissions (code, resource, action, description) VALUES
('knowledge.view', 'knowledge', 'view', 'View knowledge base entries'),
('knowledge.create', 'knowledge', 'create', 'Add new knowledge entries'),
('knowledge.edit', 'knowledge', 'edit', 'Edit knowledge entries'),
('knowledge.delete', 'knowledge', 'delete', 'Delete knowledge entries'),
('knowledge.upload', 'knowledge', 'upload', 'Bulk upload knowledge (Excel)'),
('knowledge.export', 'knowledge', 'export', 'Export knowledge data');

-- Quick Questions Permissions
INSERT INTO public.permissions (code, resource, action, description) VALUES
('quick_questions.view', 'quick_questions', 'view', 'View FAQ list'),
('quick_questions.create', 'quick_questions', 'create', 'Add new FAQs'),
('quick_questions.edit', 'quick_questions', 'edit', 'Edit FAQ entries'),
('quick_questions.delete', 'quick_questions', 'delete', 'Delete FAQs'),
('quick_questions.export', 'quick_questions', 'export', 'Export FAQ data');

-- Chat History Permissions
INSERT INTO public.permissions (code, resource, action, description) VALUES
('chat.view', 'chat', 'view', 'View chat conversation logs'),
('chat.export', 'chat', 'export', 'Export chat history'),
('chat.delete', 'chat', 'delete', 'Delete chat records'),
('chat.mark_attendance', 'chat', 'mark_attendance', 'Mark admin attendance in chats');

-- Escalations Permissions
INSERT INTO public.permissions (code, resource, action, description) VALUES
('escalations.view', 'escalations', 'view', 'View escalation requests'),
('escalations.resolve', 'escalations', 'resolve', 'Resolve/respond to escalations'),
('escalations.export', 'escalations', 'export', 'Export escalation data');

-- Companies Permissions
INSERT INTO public.permissions (code, resource, action, description) VALUES
('companies.view', 'companies', 'view', 'View company list'),
('companies.create', 'companies', 'create', 'Create new companies/tenants'),
('companies.edit', 'companies', 'edit', 'Edit company details'),
('companies.delete', 'companies', 'delete', 'Delete companies'),
('companies.manage_schema', 'companies', 'manage_schema', 'Manage company database schemas');

-- AI Settings Permissions
INSERT INTO public.permissions (code, resource, action, description) VALUES
('ai_settings.view', 'ai_settings', 'view', 'View AI configuration'),
('ai_settings.edit', 'ai_settings', 'edit', 'Modify AI settings');

-- Admin Users Permissions
INSERT INTO public.permissions (code, resource, action, description) VALUES
('admin_users.view', 'admin_users', 'view', 'View admin user list'),
('admin_users.create', 'admin_users', 'create', 'Create new admin users'),
('admin_users.edit', 'admin_users', 'edit', 'Edit admin user details'),
('admin_users.delete', 'admin_users', 'delete', 'Delete/deactivate admin users'),
('admin_users.reset_password', 'admin_users', 'reset_password', 'Reset user passwords'),
('admin_users.view_audit', 'admin_users', 'view_audit', 'View user audit logs');

-- Roles Permissions (Super Admin only by default)
INSERT INTO public.permissions (code, resource, action, description) VALUES
('roles.view', 'roles', 'view', 'View role list'),
('roles.create', 'roles', 'create', 'Create new roles'),
('roles.edit', 'roles', 'edit', 'Edit role permissions'),
('roles.delete', 'roles', 'delete', 'Delete roles');

-- ============================================================================
-- STEP 6: Create Default "Super Admin" System Role
-- ============================================================================
INSERT INTO public.roles (name, description, is_system, created_by)
VALUES (
  'Super Admin',
  'System administrator with full access to all features',
  true,
  NULL -- System-created role
)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- STEP 7: Assign ALL Permissions to Super Admin Role
-- ============================================================================
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT
  r.id AS role_id,
  p.id AS permission_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Super Admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- STEP 8: Create Default "Admin" Role (for migration of existing admins)
-- ============================================================================
INSERT INTO public.roles (name, description, is_system, created_by)
VALUES (
  'Admin',
  'Standard admin with access to operational features (no user management or AI settings)',
  false,
  NULL -- System-created role
)
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to "Admin" role (excluding super admin-only features)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT
  r.id AS role_id,
  p.id AS permission_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Admin'
AND p.code NOT IN (
  'admin_users.view',
  'admin_users.create',
  'admin_users.edit',
  'admin_users.delete',
  'admin_users.reset_password',
  'admin_users.view_audit',
  'ai_settings.view',
  'ai_settings.edit',
  'roles.view',
  'roles.create',
  'roles.edit',
  'roles.delete'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- STEP 9: Migrate Existing Admin Users to New Role System
-- ============================================================================
-- Update existing super_admin users to use "Super Admin" role
UPDATE public.admin_users
SET role_id = (SELECT id FROM public.roles WHERE name = 'Super Admin')
WHERE role = 'super_admin' AND role_id IS NULL;

-- Update existing admin users to use "Admin" role
UPDATE public.admin_users
SET role_id = (SELECT id FROM public.roles WHERE name = 'Admin')
WHERE role = 'admin' AND role_id IS NULL;

-- ============================================================================
-- STEP 10: Add Audit Logging for Role Changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.role_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  role_name VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'permissions_changed'
  changed_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  changes JSONB, -- Store what changed (permissions added/removed, etc.)
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster audit log queries
CREATE INDEX idx_role_audit_logs_role_id ON public.role_audit_logs(role_id);
CREATE INDEX idx_role_audit_logs_changed_by ON public.role_audit_logs(changed_by);
CREATE INDEX idx_role_audit_logs_created_at ON public.role_audit_logs(created_at DESC);

-- ============================================================================
-- STEP 11: Create Function to Update role updated_at Timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_role_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for roles table
DROP TRIGGER IF EXISTS trigger_update_role_timestamp ON public.roles;
CREATE TRIGGER trigger_update_role_timestamp
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION update_role_updated_at();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Uncomment to verify migration results:

-- Check all permissions created (should be 47)
-- SELECT COUNT(*) FROM public.permissions;

-- Check roles created (should be at least 2: Super Admin, Admin)
-- SELECT * FROM public.roles ORDER BY is_system DESC, name;

-- Check Super Admin has all permissions
-- SELECT COUNT(*) FROM public.role_permissions
-- WHERE role_id = (SELECT id FROM public.roles WHERE name = 'Super Admin');

-- Check admin users migrated correctly
-- SELECT username, role, r.name as role_name
-- FROM public.admin_users au
-- LEFT JOIN public.roles r ON au.role_id = r.id;

-- ============================================================================
-- ROLLBACK PROCEDURE (if needed)
-- ============================================================================
-- To rollback this migration:
-- DROP TABLE IF EXISTS public.role_audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.role_permissions CASCADE;
-- DROP TABLE IF EXISTS public.permissions CASCADE;
-- DROP TABLE IF EXISTS public.roles CASCADE;
-- ALTER TABLE public.admin_users DROP COLUMN IF EXISTS role_id;
-- DROP FUNCTION IF EXISTS update_role_updated_at() CASCADE;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
