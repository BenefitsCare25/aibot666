# Automated Schema Management Setup Guide

This guide explains how to set up and use the automated database schema creation/deletion feature for the multi-tenant insurance chatbot system.

## Overview

The system now automatically:
- ✅ Creates complete database schemas when adding a new company (no manual SQL required)
- ✅ Validates schema names to prevent conflicts
- ✅ Logs all schema operations for audit trail
- ✅ Rolls back company creation if schema creation fails
- ✅ Soft deletes companies (preserves all data)

## Setup Instructions

### 1. Configure Database Connection

You need to configure PostgreSQL access for automated schema management. **Choose the best option for your platform:**

#### Option 1: Full Connection String (Recommended for Render/Heroku/Serverless)

**Best for:** Production deployments on Render, Heroku, or other serverless platforms

**Steps:**
1. Go to Supabase Dashboard → Settings → Database → Connection String
2. Click on **"Transaction"** mode (uses port 6543 pooler)
3. Copy the full connection string
4. Add to your production environment variables:

```bash
SUPABASE_CONNECTION_STRING=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres
```

**Why Transaction mode?**
- ✅ Fixes `ENETUNREACH` IPv6 errors on Render and similar platforms
- ✅ Better compatibility with serverless environments
- ✅ More reliable connection pooling
- ✅ Lower latency

#### Option 2: Password Only (Recommended for Development)

**Best for:** Local development

**Steps:**
1. Go to Supabase Dashboard → Settings → Database
2. Look for "Connection String" section
3. Extract just the password from the string
4. Add to local `.env` file:

```bash
SUPABASE_DB_PASSWORD=your-password-here
```

The system will automatically construct the connection string using the Transaction pooler.

**IMPORTANT:** Never commit passwords or connection strings to git. The `.env` file is already in `.gitignore`.

### 2. Run Schema Activity Logs Migration

Execute the new SQL migration to create the activity logging table:

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Open the file: `backend/config/supabase-setup/08-activity-logs.sql`
3. Copy and paste the entire SQL content
4. Click "Run" to execute

This creates:
- `schema_activity_logs` table for tracking all schema operations
- Helper functions for querying logs by company or viewing failed operations
- Proper indexes for fast lookups

### 3. Install New Dependency

The `pg` (node-postgres) library has been added for direct PostgreSQL operations:

```bash
cd backend
npm install
```

(Already done if you're running the server)

### 4. Restart Backend Server

Restart the backend to load the new PostgreSQL connection pool:

```bash
cd backend
npm run dev
```

You should see:
```
[PostgreSQL] Connection pool initialized
```

If you see a warning about `SUPABASE_DB_PASSWORD`, go back to Step 1.

## How It Works

### Company Creation Flow

1. **Admin fills form** in Companies page with company details
2. **Frontend submits** to `POST /api/admin/companies`
3. **Backend creates company record** in `public.companies` table
4. **Automatic schema creation begins:**
   - Validates schema name (format, length, conflicts)
   - Creates activity log entry (status: pending)
   - Loads template from `backend/config/company-schema-template.sql`
   - Replaces `{{SCHEMA_NAME}}` placeholders with actual schema name
   - Executes SQL via PostgreSQL direct connection
   - Verifies schema was created successfully
   - Updates activity log (status: completed)
5. **Success response** includes schema creation details
6. **If schema creation fails:**
   - Rolls back company creation (deletes from registry)
   - Updates activity log (status: failed)
   - Returns error to frontend

### Company Deletion Flow

1. **Admin clicks Delete** button
2. **Confirmation dialog** explains soft delete behavior
3. **Backend soft deletes:**
   - Updates company status to 'inactive'
   - Logs deletion activity
   - Preserves all database schema and data
4. **Company disappears** from active list (can filter by status to see)

## Schema Template

The template at `backend/config/company-schema-template.sql` defines the complete schema structure:

**Includes:**
- 6 tables: employees, knowledge_base, chat_history, escalations, employee_embeddings, analytics
- Vector similarity search with HNSW indexes (pgvector)
- Row-level security (RLS) policies for data isolation
- Automatic `updated_at` triggers
- RPC functions for semantic search (`match_knowledge`, `match_employees`)
- All necessary permissions and grants

**Customization:**
- Modify the template to change the base schema structure
- All new companies will inherit these changes
- Existing schemas remain unchanged

## Usage Examples

### Creating a New Company

**Via Admin UI:**
1. Navigate to Companies page
2. Click "+ Add Company"
3. Fill in the form:
   - Company Name: "Acme Corp"
   - Primary Domain: "acmecorp.com"
   - Schema Name: "acme_corp" (auto-suggested)
   - Additional Domains: "www.acmecorp.com, app.acmecorp.com"
   - Settings: `{"brandColor": "#ff6600"}`
4. Click "Create Company"
5. **Watch the magic:**
   - Button shows "Creating schema..." with spinner
   - After 2-5 seconds: Success message shows schema name and creation time
   - Company appears in the table with active status

**API Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "Acme Corp",
    "domain": "acmecorp.com",
    "schema_name": "acme_corp",
    "status": "active"
  },
  "schema": {
    "created": true,
    "name": "acme_corp",
    "duration": 2340,
    "logId": "log-uuid-here"
  }
}
```

### Deleting a Company

**Via Admin UI:**
1. Click Delete button for the company
2. Read confirmation dialog (explains soft delete)
3. Click OK
4. Company status changes to 'inactive'
5. Schema and all data remain intact

### Viewing Activity Logs

**Via Supabase SQL Editor:**
```sql
-- View all schema operations
SELECT * FROM public.schema_activity_logs
ORDER BY created_at DESC;

-- View operations for a specific company
SELECT * FROM get_schema_activity_by_company('company-uuid-here');

-- View recent failures
SELECT * FROM get_failed_schema_operations(7); -- last 7 days
```

## Troubleshooting

### Error: "ENETUNREACH" or "connect ENETUNREACH" with IPv6 address
**Cause:** Platform doesn't support IPv6 routing to Supabase (common on Render)
**Fix:** Use Transaction pooler connection string (Option 1 in Setup):
```bash
# In your .env file on Render
SUPABASE_CONNECTION_STRING=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres
```
Then redeploy your application.

**Why this works:** The Transaction pooler (port 6543) has better network routing and handles IPv4/IPv6 fallback automatically.

### Error: "PostgreSQL connection not available"
**Cause:** No database connection configured
**Fix:** Add one of the connection options (see Setup Step 1):
- `SUPABASE_CONNECTION_STRING` (recommended for production)
- `SUPABASE_DB_PASSWORD` (for development)
- `DATABASE_URL` (if your platform provides it)

### Error: "Schema already exists"
**Cause:** Attempting to create a company with a schema name that's already in the database
**Fix:** Choose a different schema name or manually drop the existing schema

### Error: "Failed to load schema template"
**Cause:** Template file missing or unreadable
**Fix:** Ensure `backend/config/company-schema-template.sql` exists

### Schema creation takes too long
**Normal:** 2-5 seconds is typical
**Slow:** 5-10 seconds might indicate database performance issues
**Timeout:** >30 seconds suggests connection problems

### Company created but schema failed
**Auto-handled:** System automatically rolls back the company creation
**Manual cleanup (if rollback failed):**
```sql
-- Delete orphaned company
DELETE FROM public.companies WHERE id = 'company-uuid-here';
```

## Architecture Details

### File Structure
```
backend/
├── config/
│   ├── supabase.js (+ PostgreSQL pool)
│   ├── company-schema-template.sql (NEW)
│   └── supabase-setup/
│       └── 08-activity-logs.sql (NEW)
├── api/
│   ├── routes/
│   │   └── admin.js (updated endpoints)
│   └── services/
│       └── schemaAutomation.js (NEW)

frontend/admin/src/
└── pages/
    └── Companies.jsx (enhanced UI)
```

### Key Functions

**`schemaAutomation.js`:**
- `validateSchemaName()` - Format and conflict validation
- `schemaExists()` - Check if schema already exists
- `loadSchemaTemplate()` - Load and process SQL template
- `executeSQL()` - Run SQL via PostgreSQL direct connection
- `createCompanySchema()` - Complete schema creation flow
- `rollbackCompanyCreation()` - Cleanup on failure
- `softDeleteCompany()` - Mark company inactive
- `logSchemaActivity()` - Audit trail logging

### Security Considerations

**Database Password:**
- Required for DDL operations (CREATE SCHEMA, etc.)
- Never expose in API responses
- Use environment variables only
- Rotate periodically

**Schema Validation:**
- Prevents SQL injection via schema name
- Enforces PostgreSQL identifier rules
- Blocks reserved keywords
- Checks for conflicts

**Activity Logging:**
- All operations logged with timestamps
- Admin user tracking (when available)
- Error messages captured for debugging
- Metadata includes duration and context

## Maintenance

### Updating the Schema Template

When you need to modify the base schema structure:

1. Edit `backend/config/company-schema-template.sql`
2. Test changes on a development database first
3. Use `{{SCHEMA_NAME}}` placeholder for all schema references
4. Restart backend server (template is loaded at runtime)

**Note:** Changes only affect NEW companies. Existing schemas remain unchanged.

### Migration for Existing Companies

If you need to apply template changes to existing companies:

1. Create a migration SQL file
2. Loop through all schemas and apply changes
3. Test thoroughly before production

Example:
```sql
-- Apply to all existing company schemas
DO $$
DECLARE
  schema_rec RECORD;
BEGIN
  FOR schema_rec IN
    SELECT schema_name FROM public.companies
  LOOP
    EXECUTE format('
      ALTER TABLE %I.employees
      ADD COLUMN IF NOT EXISTS new_field VARCHAR(255);
    ', schema_rec.schema_name);
  END LOOP;
END $$;
```

## Next Steps

### Recommended Enhancements

1. **Admin Authentication:** Add proper admin user authentication to track who performs schema operations
2. **Schema Deletion:** Implement hard schema deletion for truly removing companies (with extreme caution)
3. **Schema Migration Tool:** Build UI for applying changes to existing schemas
4. **Monitoring Dashboard:** Visualize schema operations, failures, and performance metrics
5. **Test Data Seeding:** Add option to populate new schemas with sample data

### Testing Checklist

- [ ] Create a new company and verify schema is created
- [ ] Check activity logs table for the operation
- [ ] Verify all 6 tables exist in the new schema
- [ ] Test soft delete and verify data is preserved
- [ ] Attempt to create duplicate schema name (should fail gracefully)
- [ ] Test rollback by forcing a schema creation failure
- [ ] Check frontend UI shows loading states and success messages

## Support

If you encounter issues not covered in this guide:

1. Check activity logs in Supabase: `SELECT * FROM public.schema_activity_logs`
2. Review backend console logs for detailed error messages
3. Verify all environment variables are set correctly
4. Ensure PostgreSQL user has sufficient permissions

---

**Setup Complete! 🎉**

You can now create and manage companies with fully automated database schema provisioning.
