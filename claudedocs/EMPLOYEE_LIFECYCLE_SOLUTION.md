# Employee Lifecycle Management - Complete Solution

## 📋 Table of Contents
1. [Executive Summary](#executive-summary)
2. [Key Question: Access Control](#key-question-access-control)
3. [Implementation Steps](#implementation-steps)
4. [Code Changes](#code-changes)
5. [Testing Checklist](#testing-checklist)

---

## Executive Summary

### Problem
- Need to safely remove employees from the system when they're not in Excel uploads
- Must prevent deactivated employees from accessing the chatbot
- Must preserve all historical data (chats, escalations, logs)

### Solution: Soft Delete with Automatic Access Control

Instead of deleting employees, we:
1. ✅ Mark them as `is_active = false`
2. ✅ Automatically block chatbot access
3. ✅ Preserve ALL historical data
4. ✅ Enable reactivation anytime
5. ✅ Add optional "sync mode" for Excel uploads

### Benefits
- **Zero data loss** - All history preserved
- **Automatic blocking** - Deactivated employees can't access chatbot
- **Reversible** - Can reactivate employees
- **Audit trail** - Track who/when/why deactivated
- **Production ready** - No breaking changes

---

## Key Question: Access Control

### ❓ Will Deactivated Employees Still Access the Chatbot?

**Answer: NO - They are automatically blocked! ✅**

#### How It Works

**Authentication Flow (`backend/api/routes/chat.js` line 91):**
```javascript
// When employee tries to create chat session
const employee = await getEmployeeByEmployeeId(employeeId, req.supabase);

if (!employee) {
  return res.status(404).json({
    success: false,
    error: 'Employee not found'  // ← Deactivated employees get this
  });
}
```

**Modified Lookup Function:**
```javascript
export async function getEmployeeByEmployeeId(employeeId, supabaseClient = null, includeInactive = false) {
  let query = client
    .from('employees')
    .select('*')
    .eq('employee_id', employeeId);

  // KEY: Only returns active employees by default
  if (!includeInactive) {
    query = query.eq('is_active', true);  // ← Filters out deactivated
  }

  const { data, error } = await query.limit(1);

  if (!data || data.length === 0) {
    throw new Error('Active employee not found');
  }

  return data[0];
}
```

#### Access Control Matrix

| Status | Chatbot Access | Verification | Error Message |
|--------|---------------|--------------|---------------|
| **Active** (`is_active = true`) | ✅ Yes | ✅ Yes | None |
| **Deactivated** (`is_active = false`) | ❌ No | ❌ No | "Employee not found" |

#### Real Example

**Scenario: Upload with Sync Mode ON**
```
Excel file: EMP001, EMP002, EMP003
Database: EMP001, EMP002, EMP003, EMP004, EMP005

After upload:
✅ EMP001-003: Updated & ACTIVE → Can use chatbot
❌ EMP004-005: Marked INACTIVE → CANNOT use chatbot
✅ EMP004-005: Historical data preserved
```

**When EMP004 tries to access:**
```
1. Enters employee ID "EMP004" in widget
2. Backend: SELECT * FROM employees WHERE employee_id='EMP004' AND is_active=true
3. No results (is_active=false)
4. Returns: "Employee not found"
5. Access DENIED ❌
```

---

## Implementation Steps

### Phase 1: Database Migration

**Step 1.1: Create Migration File**

File: `backend/migrations/add-employee-status.sql`

```sql
-- Add employee status columns to all company schemas
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'public', 'extensions', 'auth', 'storage', 'graphql_public', 'realtime', 'supabase_functions', 'vault', 'pgsodium')
        AND schema_name NOT LIKE 'pg_%'
    LOOP
        -- Add columns
        EXECUTE format('ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true', schema_record.schema_name);
        EXECUTE format('ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL', schema_record.schema_name);
        EXECUTE format('ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivated_by VARCHAR(255) DEFAULT NULL', schema_record.schema_name);
        EXECUTE format('ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivation_reason TEXT DEFAULT NULL', schema_record.schema_name);

        -- Create index
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_employees_is_active ON %I.employees(is_active)', schema_record.schema_name, schema_record.schema_name);

        -- Set existing employees to active
        EXECUTE format('UPDATE %I.employees SET is_active = true WHERE is_active IS NULL', schema_record.schema_name);

        RAISE NOTICE 'Updated schema: %', schema_record.schema_name;
    END LOOP;
END $$;
```

**Step 1.2: Update Schema Template**

File: `backend/config/company-schema-template.sql`

Add to employees table (after line 40):
```sql
-- Employee lifecycle management
is_active BOOLEAN DEFAULT true,
deactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
deactivated_by VARCHAR(255) DEFAULT NULL,
deactivation_reason TEXT DEFAULT NULL,
```

Add after existing indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_{{SCHEMA_NAME}}_employees_is_active
  ON {{SCHEMA_NAME}}.employees(is_active);
```

**Step 1.3: Run Migration**

Create: `backend/migrations/run-employee-status-migration.js`
```javascript
import { postgres } from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 Starting employee status migration...');

  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'add-employee-status.sql'),
      'utf8'
    );

    await postgres.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await postgres.end();
  }
}

runMigration();
```

Run: `node backend/migrations/run-employee-status-migration.js`

---

### Phase 2: Backend Updates

**Step 2.1: Update vectorDB.js**

File: `backend/api/services/vectorDB.js`

Add these functions:

```javascript
// 1. Deactivate employee
export async function deactivateEmployee(employeeId, options = {}, supabaseClient = null) {
  const client = supabaseClient || supabase;

  const { data: employee, error } = await client
    .from('employees')
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: options.deactivatedBy || 'system',
      deactivation_reason: options.reason || 'Removed from employee list',
      updated_at: new Date().toISOString()
    })
    .eq('id', employeeId)
    .select()
    .single();

  if (error) throw error;
  return employee;
}

// 2. Reactivate employee
export async function reactivateEmployee(employeeId, supabaseClient = null) {
  const client = supabaseClient || supabase;

  const { data: employee, error } = await client
    .from('employees')
    .update({
      is_active: true,
      deactivated_at: null,
      deactivated_by: null,
      deactivation_reason: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', employeeId)
    .select()
    .single();

  if (error) throw error;
  return employee;
}

// 3. Bulk deactivate
export async function deactivateEmployeesBulk(employeeIds, options = {}, supabaseClient = null) {
  const client = supabaseClient || supabase;

  const { error } = await client
    .from('employees')
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: options.deactivatedBy || 'system',
      deactivation_reason: options.reason || 'Bulk deactivation',
      updated_at: new Date().toISOString()
    })
    .in('id', employeeIds);

  if (error) throw error;
  return employeeIds.length;
}
```

**MODIFY existing function:**

```javascript
// Replace getEmployeeByEmployeeId with this version
export async function getEmployeeByEmployeeId(employeeId, supabaseClient = null, includeInactive = false) {
  const client = supabaseClient || supabase;

  try {
    let query = client
      .from('employees')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    // KEY CHANGE: Filter by active status unless explicitly including inactive
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error(includeInactive ? 'Employee not found' : 'Active employee not found');
    }

    return data[0];
  } catch (error) {
    console.error('Error getting employee by employee_id:', error);
    throw error;
  }
}

// Also update getEmployeeByEmail similarly
export async function getEmployeeByEmail(email, supabaseClient = null, includeInactive = false) {
  const client = supabaseClient || supabase;

  try {
    let query = client
      .from('employees')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error(includeInactive ? 'Employee not found' : 'Active employee not found');
    }

    return data[0];
  } catch (error) {
    console.error('Error getting employee by email:', error);
    throw error;
  }
}
```

**Step 2.2: Update excel.js**

File: `backend/api/services/excel.js`

**MODIFY function signature (line 195):**

```javascript
// OLD:
export async function importEmployeesFromExcel(filePath, supabaseClient, duplicateAction = 'skip')

// NEW:
export async function importEmployeesFromExcel(filePath, supabaseClient, duplicateAction = 'skip', syncMode = false)
```

**ADD after line 407 (after handling duplicates):**

```javascript
// SYNC MODE: Deactivate employees not in Excel file
if (syncMode) {
  console.log('[SYNC MODE] Checking for employees to deactivate...');

  const excelEmployeeIds = employees.map(e => e.employee_id);

  // Get all currently active employees
  const { data: allActiveEmployees } = await supabaseClient
    .from('employees')
    .select('id, employee_id, name')
    .eq('is_active', true);

  // Find employees that are active but not in Excel
  const employeesToDeactivate = allActiveEmployees.filter(
    e => !excelEmployeeIds.includes(e.employee_id)
  );

  if (employeesToDeactivate.length > 0) {
    console.log(`[SYNC MODE] Deactivating ${employeesToDeactivate.length} employees`);

    const idsToDeactivate = employeesToDeactivate.map(e => e.id);

    // Deactivate in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < idsToDeactivate.length; i += BATCH_SIZE) {
      const batch = idsToDeactivate.slice(i, i + BATCH_SIZE);

      await supabaseClient
        .from('employees')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: 'excel_sync',
          deactivation_reason: 'Not present in uploaded Excel file',
          updated_at: new Date().toISOString()
        })
        .in('id', batch);

      deactivated += batch.length;
    }

    console.log(`[SYNC MODE] ✅ Deactivated ${deactivated} employees`);
  }
}
```

**UPDATE return object (line 334):**

```javascript
return {
  success: true,
  imported: imported.length,
  updated: updated.length,
  skipped: skipped.length,
  deactivated: deactivated,  // ADD THIS
  duplicates: duplicateInfo,
  errors: [],
  message: syncMode
    ? `Synced ${totalProcessed} employees: ${imported.length} imported, ${updated.length} updated, ${skipped.length} skipped, ${deactivated} deactivated`
    : `Processed ${totalProcessed} employees: ${imported.length} imported, ${updated.length} updated, ${skipped.length} skipped`
};
```

**Step 2.3: Update admin.js routes**

File: `backend/api/routes/admin.js`

**MODIFY upload endpoint (line 202):**

```javascript
// Add after line 232
const syncMode = req.body.syncMode === 'true' || req.body.syncMode === true;

// Modify line 236
const result = await importEmployeesFromExcel(
  filePath,
  req.supabase,
  duplicateAction,
  syncMode  // ADD THIS
);

// Add to response (line 252)
deactivated: result.deactivated,
```

**ADD new endpoints:**

```javascript
// Deactivate employee
router.patch('/employees/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, deactivatedBy } = req.body;

    const employee = await deactivateEmployee(id, { reason, deactivatedBy }, req.supabase);

    res.json({
      success: true,
      message: 'Employee deactivated successfully',
      data: employee
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to deactivate employee',
      details: error.message
    });
  }
});

// Reactivate employee
router.patch('/employees/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await reactivateEmployee(id, req.supabase);

    res.json({
      success: true,
      message: 'Employee reactivated successfully',
      data: employee
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to reactivate employee',
      details: error.message
    });
  }
});

// Bulk deactivate
router.post('/employees/bulk-deactivate', async (req, res) => {
  try {
    const { employeeIds, reason, deactivatedBy } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'employeeIds array is required'
      });
    }

    const deactivatedCount = await deactivateEmployeesBulk(
      employeeIds,
      { reason, deactivatedBy },
      req.supabase
    );

    res.json({
      success: true,
      message: `${deactivatedCount} employee(s) deactivated successfully`,
      deactivated: deactivatedCount
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to deactivate employees',
      details: error.message
    });
  }
});
```

**MODIFY GET /employees (line 357):**

```javascript
// Add after line 359
const status = req.query.status || 'active'; // 'active', 'inactive', 'all'

// Add after line 363
// Add status filter
if (status === 'active') {
  query = query.eq('is_active', true);
} else if (status === 'inactive') {
  query = query.eq('is_active', false);
}
// If status === 'all', no filter applied
```

---

### Phase 3: Frontend Updates

**Step 3.1: Update Employees.jsx**

File: `frontend/admin/src/pages/Employees.jsx`

**ADD state:**
```javascript
const [syncMode, setSyncMode] = useState(false);
const [statusFilter, setStatusFilter] = useState('active');
```

**ADD sync mode checkbox:**
```jsx
{/* After duplicate action radio buttons */}
<div className="sync-mode-option">
  <label className="checkbox-label">
    <input
      type="checkbox"
      checked={syncMode}
      onChange={(e) => setSyncMode(e.target.checked)}
    />
    <strong>Sync mode</strong>: Deactivate employees not in the uploaded file
    <div className="help-text">
      ⚠️ Employees missing from Excel will be marked inactive. Historical data preserved.
    </div>
  </label>
</div>
```

**UPDATE upload handler:**
```javascript
formData.append('syncMode', syncMode.toString());
```

**ADD status filter:**
```jsx
<select
  value={statusFilter}
  onChange={(e) => setStatusFilter(e.target.value)}
>
  <option value="active">Active Employees</option>
  <option value="inactive">Inactive Employees</option>
  <option value="all">All Employees</option>
</select>
```

**Step 3.2: Update employees.js API**

File: `frontend/admin/src/api/employees.js`

**ADD functions:**
```javascript
export const deactivateEmployee = async (id, reason, deactivatedBy) => {
  const response = await apiClient.patch(`/employees/${id}/deactivate`, {
    reason,
    deactivatedBy
  });
  return response.data;
};

export const reactivateEmployee = async (id) => {
  const response = await apiClient.patch(`/employees/${id}/reactivate`);
  return response.data;
};

export const bulkDeactivateEmployees = async (employeeIds, reason, deactivatedBy) => {
  const response = await apiClient.post('/employees/bulk-deactivate', {
    employeeIds,
    reason,
    deactivatedBy
  });
  return response.data;
};
```

**MODIFY getEmployees:**
```javascript
export const getEmployees = async (page = 1, limit = 20, search = '', status = 'active') => {
  const response = await apiClient.get('/employees', {
    params: { page, limit, search, status }
  });
  return response.data;
};
```

---

## Testing Checklist

### ✅ Phase 1: Database
- [ ] Run migration successfully
- [ ] Verify all schemas updated
- [ ] Check existing employees are `is_active = true`
- [ ] Confirm indexes created

### ✅ Phase 2: Backend
- [ ] Test `deactivateEmployee()` function
- [ ] Test `reactivateEmployee()` function
- [ ] Test `getEmployeeByEmployeeId()` filters inactive
- [ ] Test Excel upload with `syncMode = false` (no deactivation)
- [ ] Test Excel upload with `syncMode = true` (deactivates missing)

### ✅ Phase 3: Authentication (CRITICAL)
- [ ] **Deactivated employee CANNOT create chat session**
- [ ] **Active employee CAN create chat session**
- [ ] **Reactivated employee CAN create chat session**
- [ ] **Error message shows "Employee not found" for deactivated**

### ✅ Phase 4: Frontend
- [ ] Sync mode checkbox visible on upload page
- [ ] Status filter dropdown works (active/inactive/all)
- [ ] Upload with sync mode shows deactivation count
- [ ] Can view inactive employees

### ✅ Phase 5: Integration
- [ ] Upload Excel without sync → employees remain active
- [ ] Upload Excel with sync → missing employees deactivated
- [ ] Deactivated employee blocked from chatbot
- [ ] Historical chat data still visible in admin
- [ ] Reactivate employee → can access chatbot again

---

## Quick Reference

### Key Files Modified
1. `backend/migrations/add-employee-status.sql` - NEW
2. `backend/config/company-schema-template.sql` - MODIFY
3. `backend/api/services/vectorDB.js` - ADD 3 functions, MODIFY 2
4. `backend/api/services/excel.js` - MODIFY 1 function
5. `backend/api/routes/admin.js` - ADD 3 endpoints, MODIFY 2
6. `frontend/admin/src/pages/Employees.jsx` - ADD UI elements
7. `frontend/admin/src/api/employees.js` - ADD 3 functions

### Database Changes
- Add 4 columns: `is_active`, `deactivated_at`, `deactivated_by`, `deactivation_reason`
- Add 1 index: `idx_employees_is_active`

### New API Endpoints
- `PATCH /api/admin/employees/:id/deactivate`
- `PATCH /api/admin/employees/:id/reactivate`
- `POST /api/admin/employees/bulk-deactivate`

### Behavior Changes
- `getEmployeeByEmployeeId()` - Now filters `is_active = true` by default
- `getEmployeeByEmail()` - Now filters `is_active = true` by default
- `importEmployeesFromExcel()` - New `syncMode` parameter
- `GET /api/admin/employees` - New `status` query parameter

---

## Deployment Steps

1. ✅ **Backup database** via Supabase dashboard
2. ✅ **Run migration**: `node backend/migrations/run-employee-status-migration.js`
3. ✅ **Verify migration**: Check one schema manually
4. ✅ **Deploy backend** code
5. ✅ **Deploy frontend** code
6. ✅ **Test with 1-2 employees** first
7. ✅ **Monitor for 24 hours**
8. ✅ **Full rollout**

---

## Rollback Plan

If issues occur:

1. Set all employees active: `UPDATE schema.employees SET is_active = true;`
2. Disable sync mode in frontend
3. Stop using deactivate endpoints
4. If needed, remove columns (within 24h):
```sql
ALTER TABLE schema.employees
  DROP COLUMN is_active,
  DROP COLUMN deactivated_at,
  DROP COLUMN deactivated_by,
  DROP COLUMN deactivation_reason;
```

---

## Summary

✅ **Deactivated employees CANNOT access chatbot** - Automatic blocking
✅ **Historical data preserved** - No data loss
✅ **Reversible operations** - Can reactivate anytime
✅ **Production ready** - No breaking changes
✅ **Audit trail** - Track all status changes

**Ready to implement!** 🚀
