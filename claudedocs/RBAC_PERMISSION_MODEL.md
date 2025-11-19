# Role-Based Access Control (RBAC) Permission Model

## System Overview
- **One Super Admin** - Full system access, cannot be modified
- **Custom Roles** - Super Admin creates roles with free text names
- **Role Assignment** - Admin users get assigned one role
- **Permission Inheritance** - Users inherit all permissions from their assigned role

---

## Permission Structure

### Format: `resource.action`
- **resource** - The page/module (dashboard, employees, knowledge, etc.)
- **action** - What can be done (view, create, edit, delete, export, etc.)

---

## Complete Permission List

### 1. Dashboard
| Permission Code | Description | Default Super Admin |
|----------------|-------------|---------------------|
| `dashboard.view` | View dashboard and analytics | ✅ |
| `dashboard.export` | Export dashboard data | ✅ |

### 2. Employees
| Permission Code | Description | Default Super Admin |
|----------------|-------------|---------------------|
| `employees.view` | View employee list | ✅ |
| `employees.create` | Add new employees | ✅ |
| `employees.edit` | Edit employee details | ✅ |
| `employees.delete` | Delete/deactivate employees | ✅ |
| `employees.upload` | Bulk upload employees (Excel) | ✅ |
| `employees.export` | Export employee data | ✅ |

### 3. Knowledge Base
| Permission Code | Description | Default Super Admin |
|----------------|-------------|---------------------|
| `knowledge.view` | View knowledge base entries | ✅ |
| `knowledge.create` | Add new knowledge entries | ✅ |
| `knowledge.edit` | Edit knowledge entries | ✅ |
| `knowledge.delete` | Delete knowledge entries | ✅ |
| `knowledge.upload` | Bulk upload knowledge (Excel) | ✅ |
| `knowledge.export` | Export knowledge data | ✅ |

### 4. Quick Questions
| Permission Code | Description | Default Super Admin |
|----------------|-------------|---------------------|
| `quick_questions.view` | View FAQ list | ✅ |
| `quick_questions.create` | Add new FAQs | ✅ |
| `quick_questions.edit` | Edit FAQ entries | ✅ |
| `quick_questions.delete` | Delete FAQs | ✅ |
| `quick_questions.export` | Export FAQ data | ✅ |

### 5. Chat History
| Permission Code | Description | Default Super Admin |
|----------------|-------------|---------------------|
| `chat.view` | View chat conversation logs | ✅ |
| `chat.export` | Export chat history | ✅ |
| `chat.delete` | Delete chat records | ✅ |
| `chat.mark_attendance` | Mark admin attendance in chats | ✅ |

### 6. Escalations
| Permission Code | Description | Default Super Admin |
|----------------|-------------|---------------------|
| `escalations.view` | View escalation requests | ✅ |
| `escalations.resolve` | Resolve/respond to escalations | ✅ |
| `escalations.export` | Export escalation data | ✅ |

### 7. Companies (Multi-tenant Management)
| Permission Code | Description | Default Super Admin |
|----------------|-------------|---------------------|
| `companies.view` | View company list | ✅ |
| `companies.create` | Create new companies/tenants | ✅ |
| `companies.edit` | Edit company details | ✅ |
| `companies.delete` | Delete companies | ✅ |
| `companies.manage_schema` | Manage company database schemas | ✅ |

### 8. AI Settings
| Permission Code | Description | Default Super Admin |
|----------------|-------------|---------------------|
| `ai_settings.view` | View AI configuration | ✅ |
| `ai_settings.edit` | Modify AI settings | ✅ |

### 9. Admin Users
| Permission Code | Description | Default Super Admin |
|----------------|-------------|---------------------|
| `admin_users.view` | View admin user list | ✅ |
| `admin_users.create` | Create new admin users | ✅ |
| `admin_users.edit` | Edit admin user details | ✅ |
| `admin_users.delete` | Delete/deactivate admin users | ✅ |
| `admin_users.reset_password` | Reset user passwords | ✅ |
| `admin_users.view_audit` | View user audit logs | ✅ |

### 10. Roles (New - Super Admin Only)
| Permission Code | Description | Default Super Admin |
|----------------|-------------|---------------------|
| `roles.view` | View role list | ✅ |
| `roles.create` | Create new roles | ✅ |
| `roles.edit` | Edit role permissions | ✅ |
| `roles.delete` | Delete roles | ✅ |

---

## Database Schema

### Table: `public.roles`
```sql
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false, -- true for "Super Admin" role
  created_by UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `public.permissions`
```sql
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL, -- e.g., "employees.view"
  resource VARCHAR(50) NOT NULL, -- e.g., "employees"
  action VARCHAR(50) NOT NULL, -- e.g., "view"
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `public.role_permissions`
```sql
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);
```

### Update Table: `public.admin_users`
```sql
-- Add role_id column to existing admin_users table
ALTER TABLE public.admin_users
ADD COLUMN role_id UUID REFERENCES public.roles(id);

-- Keep existing 'role' column for backward compatibility during migration
-- Will be removed after full migration
```

---

## Role Examples

### Example 1: HR Manager
**Role Name:** "HR Support Team" (free text)
**Permissions:**
- ✅ `dashboard.view`
- ✅ `employees.view`, `employees.create`, `employees.edit`, `employees.upload`, `employees.export`
- ✅ `chat.view`, `chat.export`
- ❌ All other permissions denied

### Example 2: Customer Support Agent
**Role Name:** "Customer Support" (free text)
**Permissions:**
- ✅ `dashboard.view`
- ✅ `chat.view`, `chat.mark_attendance`
- ✅ `escalations.view`, `escalations.resolve`
- ✅ `knowledge.view`
- ❌ All other permissions denied

### Example 3: Content Manager
**Role Name:** "Knowledge Base Editor" (free text)
**Permissions:**
- ✅ `knowledge.view`, `knowledge.create`, `knowledge.edit`, `knowledge.delete`, `knowledge.upload`
- ✅ `quick_questions.view`, `quick_questions.create`, `quick_questions.edit`, `quick_questions.delete`
- ❌ All other permissions denied

### Example 4: Read-Only Viewer
**Role Name:** "Analytics Viewer" (free text)
**Permissions:**
- ✅ `dashboard.view`, `dashboard.export`
- ✅ `employees.view`, `employees.export`
- ✅ `chat.view`, `chat.export`
- ❌ No create, edit, delete permissions

---

## Frontend Permission Grouping (For UI)

### Page-Level Groups (Checkboxes with expand for granular control)

```
📊 Dashboard
  └─ View Dashboard
  └─ Export Data

👥 Employees
  └─ View Employees
  └─ Create Employees
  └─ Edit Employees
  └─ Delete Employees
  └─ Bulk Upload
  └─ Export Data

📚 Knowledge Base
  └─ View Knowledge
  └─ Create Entries
  └─ Edit Entries
  └─ Delete Entries
  └─ Bulk Upload
  └─ Export Data

❓ Quick Questions
  └─ View FAQs
  └─ Create FAQs
  └─ Edit FAQs
  └─ Delete FAQs
  └─ Export Data

💬 Chat History
  └─ View Chats
  └─ Mark Attendance
  └─ Export Chats
  └─ Delete Chats

🚨 Escalations
  └─ View Escalations
  └─ Resolve Escalations
  └─ Export Data

🏢 Companies
  └─ View Companies
  └─ Create Companies
  └─ Edit Companies
  └─ Delete Companies
  └─ Manage Schemas

🤖 AI Settings
  └─ View Settings
  └─ Edit Settings

👤 Admin Users
  └─ View Users
  └─ Create Users
  └─ Edit Users
  └─ Delete Users
  └─ Reset Passwords
  └─ View Audit Logs

🔐 Roles (Super Admin Only)
  └─ View Roles
  └─ Create Roles
  └─ Edit Roles
  └─ Delete Roles
```

---

## Implementation Notes

### Backend Middleware
```javascript
// Check if user has specific permission
requirePermission('employees.create')

// Check if user has any of these permissions
requireAnyPermission(['employees.view', 'employees.edit'])

// Check if user has all of these permissions
requireAllPermissions(['employees.view', 'employees.edit'])
```

### Frontend Permission Hook
```javascript
const { can, canAny, canAll } = usePermissions();

// Show button only if user can create employees
{can('employees.create') && <button>Add Employee</button>}

// Show page only if user can view OR edit
{canAny('employees.view', 'employees.edit') && <EmployeePage />}
```

### Super Admin Protection
- Super Admin role is marked with `is_system = true`
- Cannot delete or modify Super Admin role
- Cannot remove role from the only Super Admin user
- Super Admin always has ALL permissions (hardcoded bypass)

---

## Migration Strategy

1. ✅ Create new tables: `roles`, `permissions`, `role_permissions`
2. ✅ Seed default permissions (all 40+ permissions listed above)
3. ✅ Create "Super Admin" system role with all permissions
4. ✅ Migrate existing `admin_users` to use new role system
5. ✅ Add `role_id` column to `admin_users` table
6. ✅ Update existing Super Admins to use "Super Admin" role
7. ✅ Update existing Admins to create a default "Admin" role
8. ✅ Keep old `role` column temporarily for rollback capability
9. ✅ After testing, remove old `role` column

---

**Total Permissions Defined:** 47 granular permissions across 10 modules
