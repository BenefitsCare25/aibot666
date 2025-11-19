# Frontend RBAC Updates - Manual Steps

## STATUS

✅ **COMPLETED:**
- Roles.jsx page created
- usePermissions hook created
- App.jsx route added (`/roles`)

❌ **NEEDS MANUAL UPDATE:**
- Layout.jsx navigation link (sidebar)
- CreateAdminModal.jsx role dropdown

---

## 1. Add Roles Link to Navigation (Layout.jsx)

**File:** `frontend/admin/src/components/Layout.jsx`

**Location:** After the "Admin Users" NavLink (around line 84)

**Add this code:**

```jsx
              <NavLink
                to="/roles"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white border-l-4 border-primary-400'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <span className="text-xl">🔐</span>
                Roles
              </NavLink>
```

**Full context - should look like this:**

```jsx
          {/* Super Admin Only Pages */}
          {user?.role === 'super_admin' && (
            <>
              <NavLink to="/ai-settings" ...>
                AI Settings
              </NavLink>
              <NavLink to="/admin-users" ...>
                Admin Users
              </NavLink>
              {/* ADD THIS NEXT NavLink HERE */}
              <NavLink to="/roles" ...>
                Roles
              </NavLink>
            </>
          )}
```

---

## 2. Update CreateAdminModal for Role Assignment

**File:** `frontend/admin/src/components/CreateAdminModal.jsx`

### 2A. Add Imports

```jsx
import { useState, useEffect } from 'react'; // Change from just useState
import { createAdminUser } from '../api/adminUsers';
import axios from 'axios'; // ADD THIS

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'; // ADD THIS
```

### 2B. Update State

Replace the `formData` state to include `roleId`:

```jsx
const [formData, setFormData] = useState({
  username: '',
  password: '',
  confirmPassword: '',
  role: '', // Legacy
  roleId: '', // NEW - for RBAC
  fullName: '',
  email: ''
});

// ADD these new states:
const [roles, setRoles] = useState([]);
const [loadingRoles, setLoadingRoles] = useState(true);
const [useNewRoleSystem, setUseNewRoleSystem] = useState(false);
```

### 2C. Add useEffect to Fetch Roles

```jsx
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
```

### 2D. Update handleSubmit

Replace the payload creation in `handleSubmit`:

```jsx
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

    // ADD THIS CONDITIONAL LOGIC:
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
```

### 2E. Replace Role Select Section

Find the Role select section (around line 150-168) and replace with:

```jsx
{/* Role */}
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

---

## 3. Testing After Updates

1. **Stop dev server** if running: `Ctrl+C`
2. Make the above changes
3. **Restart dev server**: `npm run dev`
4. **Clear browser cache** and reload
5. Login as Super Admin
6. You should see **"Roles"** link in sidebar
7. Click it to access Role Management page

---

## Quick Test Checklist

- [ ] "Roles" link appears in sidebar (Super Admin only)
- [ ] Clicking "Roles" loads the Role Management page
- [ ] Can create a new role with permissions
- [ ] When creating admin user, see role dropdown with created roles
- [ ] Can assign role to new user
- [ ] Role appears correctly in Admin Users table

---

**Need Help?** See full deployment guide: `claudedocs/RBAC_DEPLOYMENT_GUIDE.md`
