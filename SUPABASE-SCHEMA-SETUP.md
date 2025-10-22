# Supabase Multi-Schema Setup Guide

## Problem
Supabase PostgREST API only exposes the `public` schema by default. Custom schemas (`company_a`, `company_b`) are not accessible via the JS client.

## Solution: Expose Custom Schemas in Supabase

### Step 1: Enable Schemas in Supabase Dashboard

1. **Login to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Go to Settings → API**
4. **Find "Exposed schemas" section**
5. **Add your schemas**: `company_a, company_b`
6. **Click Save**

### Step 2: Grant Permissions (Run in SQL Editor)

Run the SQL script in `backend/config/supabase-setup/06-enable-api-schemas.sql`:

```sql
-- Grant usage on schemas
GRANT USAGE ON SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA company_b TO postgres, anon, authenticated, service_role;

-- Grant permissions on all tables
GRANT ALL ON ALL TABLES IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA company_b TO postgres, anon, authenticated, service_role;

-- Grant permissions on sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA company_b TO postgres, anon, authenticated, service_role;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA company_b TO postgres, anon, authenticated, service_role;
```

### Step 3: Verify Schema Access

Test in SQL Editor:

```sql
-- Check exposed schemas
SHOW pgrst.db_schemas;

-- Test query (should work after setup)
SELECT * FROM company_a.employees LIMIT 1;
SELECT * FROM company_b.employees LIMIT 1;
```

### Step 4: Update Supabase Client

The client is already configured to use schema-qualified table names:
- `client.from('employees')` → queries `company_a.employees`
- `client.rpc('match_knowledge')` → calls `company_a.match_knowledge()`

## Alternative: Use pg connection string

If you can't modify the dashboard settings, use direct PostgreSQL connection with node-postgres:

```javascript
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

// Set search_path per query
await pool.query(`SET search_path TO ${schemaName}, public`);
await pool.query('SELECT * FROM employees');
```

## Current Status

- ✅ Database schemas created (`company_a`, `company_b`)
- ✅ Tables and functions in each schema
- ✅ Multi-tenant routing configured
- ⏳ **PENDING**: Expose schemas in Supabase Dashboard API settings
- ⏳ **PENDING**: Grant permissions to API roles

## After Setup

Once schemas are exposed, the chatbot will work correctly with:
- Domain-based company detection
- Isolated knowledge bases per company
- Company-specific employee data
- Separate chat histories and analytics
