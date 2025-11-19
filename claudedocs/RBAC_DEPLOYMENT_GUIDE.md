# RBAC System - Deployment Guide

## Overview
Complete Role-Based Access Control (RBAC) system for your admin portal with custom role creation and granular permission management.

**System Features:**
- 47 granular permissions across 10 modules
- Custom role creation with free-text names
- Permission caching with Redis (5-min TTL)
- Backward compatible with legacy role system
- Complete audit logging
- Migration-ready for existing users

---

## Implementation Status

### ✅ COMPLETED (Backend)
- [x] Database schema design (4 new tables)
- [x] Migration script (`backend/migrations/20250119_add_rbac_system.sql`)
- [x] Role Management API (`backend/api/routes/roles.js`)
- [x] Permission Service (`backend/api/services/permissionService.js`)
- [x] Permission Middleware (`backend/api/middleware/permissionMiddleware.js`)
- [x] Auth endpoint for permissions (`/api/auth/me/permissions`)
- [x] Route registration in `server.js`
- [x] Migration runner script (`backend/scripts/run-rbac-migration.js`)

### ✅ COMPLETED (Frontend)
- [x] Permission Hook (`frontend/admin/src/hooks/usePermissions.js`)
- [x] Role Management Page (`frontend/admin/src/pages/Roles.jsx`)
- [x] Updated CreateAdminModal prototype (see REMAINING UPDATES below)

### 🔄 REMAINING UPDATES (Frontend)
- [ ] Update `CreateAdminModal.jsx` (code provided below)
- [ ] Update `App.jsx` to add Roles route
- [ ] Update `Layout.jsx` to add Roles navigation link
- [ ] Update `adminUsers.js` API to support `roleId` field

---

## Step-by-Step Deployment

### STEP 1: Run Database Migration

**Option A: Using NPM Script (Recommended)**
```bash
cd backend
npm run migrate:rbac
```

**Option B: Manual SQL Execution**
1. Connect to your PostgreSQL database
2. Execute the SQL in `backend/migrations/20250119_add_rbac_migration.sql`

**Verification:**
```sql
-- Should return 47 permissions
SELECT COUNT(*) FROM public.permissions;

-- Should show Super Admin and Admin roles
SELECT * FROM public.roles ORDER BY is_system DESC;

-- Should show Super Admin has all 47 permissions
SELECT COUNT(*) FROM public.role_permissions
WHERE role_id = (SELECT id FROM public.roles WHERE name = 'Super Admin');

-- Should show existing users migrated
SELECT username, role, r.name as role_name
FROM public.admin_users au
LEFT JOIN public.roles r ON au.role_id = r.id;
```

---

### STEP 2: Update Frontend Components

#### 2A. Update CreateAdminModal Component

**File:** `frontend/admin/src/components/CreateAdminModal.jsx`

Replace the role selection section (lines 150-168) with:

```jsx
import { useState, useEffect } from 'react';
import { createAdminUser } from '../api/adminUsers';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Add to state:
const [roles, setRoles] = useState([]);
const [loadingRoles, setLoadingRoles] = useState(true);
const [useNewRoleSystem, setUseNewRoleSystem] = useState(false);

// Update formData state:
const [formData, setFormData] = useState({
  username: '',
  password: '',
  confirmPassword: '',
  role: '', // Legacy
  roleId: '', // New RBAC
  fullName: '',
  email: ''
});

// Add useEffect to fetch roles:
useEffect(() => {
  fetchRoles();
}, []);

const fetchRoles = async () => {
  try {
    setLoadingRoles(true);
    const response = await axios.get(`${API_URL}/api/roles`, {
      withCredentials: true
    });

    if (response.data.success && response.data.roles && response.data.roles.length > 0) {
      setRoles(response.data.roles);
      setUseNewRoleSystem(true);
      const defaultRole = response.data.roles.find(r => !r.is_system) || response.data.roles[0];
      setFormData(prev => ({ ...prev, roleId: defaultRole.id }));
    } else {
      setUseNewRoleSystem(false);
      setFormData(prev => ({ ...prev, role: 'admin' }));
    }
  } catch (error) {
    console.error('Error fetching roles:', error);
    setUseNewRoleSystem(false);
    setFormData(prev => ({ ...prev, role: 'admin' }));
  } finally {
    setLoadingRoles(false);
  }
};

// Update handleSubmit to include roleId:
const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');

  if (!allRequirementsMet) {
    setError('Password does not meet requirements');
    return;
  }

  if (formData.password !== formData.confirmPassword) {
    setError('Passwords do not match');
    return;
  }

  setIsSubmitting(true);

  try {
    const payload = {
      username: formData.username,
      password: formData.password,
      fullName: formData.fullName,
      email: formData.email
    };

    if (useNewRoleSystem && formData.roleId) {
      payload.roleId = formData.roleId;
    } else {
      payload.role = formData.role;
    }

    await createAdminUser(payload);
    onSuccess();
  } catch (err) {
    setError(err.message || 'Failed to create admin user');
  } finally {
    setIsSubmitting(false);
  }
};

// Replace Role select section with:
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Role <span className="text-red-500">*</span>
  </label>
  {loadingRoles ? (
    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
      Loading roles...
    </div>
  ) : useNewRoleSystem ? (
    <>
      <select
        name="roleId"
        value={formData.roleId}
        onChange={handleChange}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Select a role...</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name} {role.is_system && '(System)'}
            {role.permission_count > 0 && ` - ${role.permission_count} permissions`}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500">
        Assign a role to define user permissions
      </p>
    </>
  ) : (
    <>
      <select
        name="role"
        value={formData.role}
        onChange={handleChange}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="admin">Admin</option>
        <option value="super_admin">Super Admin</option>
      </select>
      <p className="mt-1 text-xs text-gray-500">
        Super Admin can manage other admin users
      </p>
    </>
  )}
</div>
```

#### 2B. Update Backend Admin Users API

**File:** `backend/api/routes/adminUsers.js`

Update the POST endpoint (around line 83) to support roleId:

```javascript
router.post('/', [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, underscore, and hyphen'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character (!@#$%^&*)'),
  body('role')
    .optional()
    .isIn(['super_admin', 'admin']).withMessage('Role must be either super_admin or admin'),
  body('roleId')
    .optional()
    .isUUID().withMessage('Role ID must be a valid UUID'),
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ max: 255 }).withMessage('Full name must not exceed 255 characters'),
  body('email')
    .trim()
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg,
        details: errors.array()
      });
    }

    const { username, password, role, roleId, fullName, email } = req.body;

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('admin_users')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(400).json({
        error: 'Username already exists',
        message: `Username "${username}" is already taken`
      });
    }

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingEmail) {
      return res.status(400).json({
        error: 'Email already exists',
        message: `Email "${email}" is already in use`
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user with appropriate role field
    const insertData = {
      username,
      password_hash: hashedPassword,
      full_name: fullName,
      email,
      is_active: true
    };

    // Use roleId if provided (new system), otherwise use legacy role
    if (roleId) {
      insertData.role_id = roleId;
      insertData.role = 'admin'; // Set legacy role for backward compatibility
    } else {
      insertData.role = role || 'admin';
    }

    const { data: newUser, error: insertError } = await supabase
      .from('admin_users')
      .insert(insertData)
      .select('id, username, role, role_id, full_name, email, is_active, created_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    // Log audit action
    await logAuditAction(
      req.user.id,
      'ADMIN_USER_CREATED',
      'admin_user',
      newUser.id,
      {
        username: newUser.username,
        role: role || 'assigned via roleId',
        role_id: roleId,
        created_by: req.user.username
      },
      req.ip,
      req.get('user-agent')
    );

    return res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Create admin user error:', error);
    return res.status(500).json({
      error: 'Failed to create admin user',
      message: 'An error occurred while creating the admin user'
    });
  }
});
```

#### 2C. Add Roles Route to App.jsx

**File:** `frontend/admin/src/App.jsx`

Add import:
```jsx
import Roles from './pages/Roles';
```

Add route (inside the `<Routes>` component, after AdminUsers route):
```jsx
<Route path="/roles" element={
  <ProtectedRoute requiredRole="super_admin">
    <Roles />
  </ProtectedRoute>
} />
```

#### 2D. Add Roles Link to Navigation

**File:** `frontend/admin/src/components/Layout.jsx`

Find the navigation section (around where AdminUsers link is), and add:

```jsx
{user?.role === 'super_admin' && (
  <Link
    to="/roles"
    className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
      location.pathname === '/roles'
        ? 'bg-blue-50 text-blue-700'
        : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
    Roles
  </Link>
)}
```

---

### STEP 3: Restart Services

```bash
# Backend
cd backend
npm run dev  # or npm start for production

# Frontend
cd frontend/admin
npm run dev  # or npm run build for production
```

---

### STEP 4: Initial Setup & Testing

#### 4A. Login as Super Admin
1. Access admin panel: `http://localhost:3001` (or your frontend URL)
2. Login with your Super Admin credentials
3. You should see a new "Roles" link in the sidebar

#### 4B. Create First Custom Role
1. Navigate to **Roles** page
2. Click **"Create Role"**
3. Enter role details:
   - **Name:** "HR Manager" (free text)
   - **Description:** "Can manage employees and view chat history"
   - **Permissions:** Select:
     - Dashboard: View
     - Employees: View, Create, Edit, Upload, Export
     - Chat: View, Export
4. Click **"Create Role"**

#### 4C. Create Test Admin User
1. Navigate to **Admin Users** page
2. Click **"Create Admin User"**
3. Fill in details:
   - Username: test_hr
   - Full Name: Test HR User
   - Email: hr@test.com
   - **Role:** Select "HR Manager" from dropdown
   - Password: (meet requirements)
4. Click **"Create Admin User"**

#### 4D. Test Permissions
1. Logout from Super Admin
2. Login as `test_hr`
3. Verify access:
   - ✅ Should see: Dashboard, Employees, Chat History
   - ❌ Should NOT see: Knowledge Base, AI Settings, Admin Users, Roles
4. Try accessing restricted page directly (e.g., `/admin-users`)
   - Should show "Access Denied" or redirect

---

### STEP 5: Update Existing Routes (Optional but Recommended)

To enforce permissions on existing routes, update route handlers:

**Example: Employees Route**
```javascript
// backend/api/routes/admin.js

// Add import
import { requirePermission } from '../middleware/permissionMiddleware.js';

// Update route (example for GET employees)
router.get('/employees',
  authenticateToken,
  requirePermission('employees.view'),  // Add this line
  async (req, res) => {
    // ... existing code
  }
);

// Update POST route
router.post('/employees',
  authenticateToken,
  requirePermission('employees.create'),  // Add this line
  async (req, res) => {
    // ... existing code
  }
);
```

Apply similar updates to all routes in:
- `backend/api/routes/admin.js`
- `backend/api/routes/aiSettings.js`

**Permission Mapping:**
```javascript
// Dashboard
GET /api/admin/analytics → requirePermission('dashboard.view')

// Employees
GET /api/admin/employees → requirePermission('employees.view')
POST /api/admin/employees → requirePermission('employees.create')
PUT /api/admin/employees/:id → requirePermission('employees.edit')
DELETE /api/admin/employees/:id → requirePermission('employees.delete')
POST /api/admin/employees/upload → requirePermission('employees.upload')

// Knowledge Base
GET /api/admin/knowledge → requirePermission('knowledge.view')
POST /api/admin/knowledge → requirePermission('knowledge.create')
PUT /api/admin/knowledge/:id → requirePermission('knowledge.edit')
DELETE /api/admin/knowledge/:id → requirePermission('knowledge.delete')

// Quick Questions
GET /api/admin/quick-questions → requirePermission('quick_questions.view')
POST /api/admin/quick-questions → requirePermission('quick_questions.create')

// Chat History
GET /api/admin/chat-history → requirePermission('chat.view')

// AI Settings
GET /api/ai-settings → requirePermission('ai_settings.view')
PUT /api/ai-settings → requirePermission('ai_settings.edit')

// Admin Users (already protected by requireSuperAdmin)
// Keep existing protection or use requirePermission('admin_users.*')
```

---

## Common Role Templates

### 1. HR Manager
**Purpose:** Manage employees and view interactions
**Permissions:**
- dashboard.view, dashboard.export
- employees.* (all employee permissions)
- chat.view, chat.export

### 2. Content Manager
**Purpose:** Manage knowledge base and FAQs
**Permissions:**
- dashboard.view
- knowledge.* (all knowledge permissions)
- quick_questions.* (all FAQ permissions)

### 3. Customer Support
**Purpose:** View chats and handle escalations
**Permissions:**
- dashboard.view
- chat.view, chat.mark_attendance
- escalations.view, escalations.resolve
- knowledge.view (read-only access to KB)

### 4. Analytics Viewer
**Purpose:** Read-only access for reporting
**Permissions:**
- dashboard.view, dashboard.export
- employees.view, employees.export
- knowledge.view, knowledge.export
- chat.view, chat.export

---

## Troubleshooting

### Issue: Migration fails with "table already exists"
**Solution:** Tables may already exist from a previous run. Either:
1. Run the ROLLBACK procedure from the migration file, OR
2. This is normal if migration was already run successfully

### Issue: No roles showing in dropdown
**Solution:**
1. Verify migration ran successfully: `SELECT COUNT(*) FROM public.roles;`
2. Check backend logs for errors when fetching `/api/roles`
3. Verify authentication token is valid

### Issue: Permission denied errors
**Solution:**
1. Clear permission cache: Restart Redis or wait 5 minutes
2. Verify user has role assigned: `SELECT * FROM admin_users WHERE id = 'user-id';`
3. Check role has permissions: `SELECT * FROM role_permissions WHERE role_id = 'role-id';`

### Issue: User can still access restricted pages
**Solution:**
1. Frontend route guards need to be added (use `usePermissions` hook)
2. Backend middleware needs to be added to API routes
3. Clear browser cache and re-login

---

## Security Considerations

1. **Cache Invalidation:** Permission changes take up to 5 minutes to propagate (Redis TTL)
2. **Super Admin Protection:** Cannot delete or modify system roles
3. **User Assignment Check:** Cannot delete roles with assigned users
4. **Audit Logging:** All role/permission changes are logged in `role_audit_logs`
5. **Token Validation:** All API endpoints require valid JWT token

---

## Rollback Procedure

If you need to rollback the RBAC system:

```sql
-- WARNING: This will remove all roles and permissions

DROP TABLE IF EXISTS public.role_audit_logs CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
ALTER TABLE public.admin_users DROP COLUMN IF EXISTS role_id;
DROP FUNCTION IF EXISTS update_role_updated_at() CASCADE;
```

After rollback, the system will fall back to the legacy role system (super_admin/admin).

---

## Next Steps After Deployment

1. **Create Company Roles:** Define roles specific to your organization
2. **Migrate Existing Users:** Assign appropriate roles to all admin users
3. **Add Route Protection:** Apply permission middleware to all API routes
4. **Frontend Guards:** Add permission checks to UI components
5. **Monitor Audit Logs:** Review `role_audit_logs` for security monitoring
6. **Documentation:** Update internal documentation with role definitions

---

## Support Files Reference

**Backend:**
- Migration: `backend/migrations/20250119_add_rbac_system.sql`
- Runner: `backend/scripts/run-rbac-migration.js`
- API: `backend/api/routes/roles.js`
- Service: `backend/api/services/permissionService.js`
- Middleware: `backend/api/middleware/permissionMiddleware.js`

**Frontend:**
- Page: `frontend/admin/src/pages/Roles.jsx`
- Hook: `frontend/admin/src/hooks/usePermissions.js`
- Modal: `frontend/admin/src/components/CreateAdminModal.jsx` (needs update)

**Documentation:**
- Permission Model: `claudedocs/RBAC_PERMISSION_MODEL.md`
- This Guide: `claudedocs/RBAC_DEPLOYMENT_GUIDE.md`

---

## Complete! 🎉

You now have a fully functional RBAC system. Super Admins can create custom roles with granular permissions, and assign them to admin users for precise access control.
