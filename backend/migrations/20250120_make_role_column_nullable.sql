-- ============================================================================
-- Make admin_users.role Column Nullable
-- Created: 2025-01-20
-- Purpose: Allow creating admin users with role_id only (RBAC system)
-- ============================================================================

-- Make the legacy 'role' column nullable to support RBAC transition
-- Users can now be created with either role (legacy) or role_id (RBAC)
ALTER TABLE public.admin_users
ALTER COLUMN role DROP NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify column is now nullable:
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'admin_users' AND column_name = 'role';
-- Expected: is_nullable = 'YES'

-- ============================================================================
-- NOTES
-- ============================================================================
-- After this migration:
-- 1. Existing users will keep their role values (super_admin, admin)
-- 2. New users created via RBAC can have role = NULL and use role_id instead
-- 3. The role column will be fully deprecated and removed in a future migration
-- 4. For now, both systems work in parallel for backward compatibility
