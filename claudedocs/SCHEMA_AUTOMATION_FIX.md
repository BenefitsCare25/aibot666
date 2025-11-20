# Schema Automation Fix - "Tenant or user not found" Error

## Problem

When creating a new company schema via the admin panel, you encounter this error:

```
error: Tenant or user not found
code: XX000
severity: FATAL
```

## Root Cause

**The error occurs when using Supabase's Transaction Pooler (port 6543) for DDL operations.**

### Why This Happens:

1. **Transaction Pooler Limitation**: Supabase's transaction pooler (port 6543) is designed for short-lived transactions and **does NOT support DDL operations** like:
   - `CREATE SCHEMA`
   - `DROP SCHEMA`
   - `CREATE TABLE`
   - `ALTER TABLE`
   - Other schema modifications

2. **Authentication Method Mismatch**: The pooler expects session-mode authentication but the pg Pool client uses transaction-mode authentication, causing the "Tenant or user not found" error.

3. **Error Code XX000**: This is a PostgreSQL internal error code indicating a pooler authentication failure.

## Solution

**Use the Direct Connection (port 5432) instead of the Transaction Pooler (port 6543).**

### What We Changed:

1. **Forced Direct Connection in `backend/config/supabase.js`**:
   ```javascript
   // OLD (BROKEN):
   const usePooler = process.env.USE_SUPABASE_POOLER !== 'false'; // Default to true
   const port = usePooler ? 6543 : 5432;

   // NEW (FIXED):
   const usePooler = false; // Force direct connection for DDL operations
   const port = 5432; // Always use direct connection port
   ```

2. **Auto-Detection and Correction**: The code now automatically detects if `DATABASE_URL` or `SUPABASE_CONNECTION_STRING` uses port 6543 and replaces it with 5432:
   ```javascript
   if (dbUrl.includes(':6543')) {
     console.warn('[PostgreSQL] WARNING: DATABASE_URL uses pooler port 6543. DDL operations require port 5432!');
     const directUrl = dbUrl.replace(':6543/', ':5432/');
     return directUrl;
   }
   ```

3. **Connection Test on Startup**: Added automatic connection testing to diagnose issues early:
   ```javascript
   pgPool.query('SELECT version(), current_user, current_database()', (err, result) => {
     if (err.code === 'XX000') {
       console.error('[PostgreSQL] XX000 Error: This usually means pooler authentication failure.');
       console.error('[PostgreSQL] Solution: Ensure you are using port 5432 (direct connection), NOT 6543 (pooler)');
     }
   });
   ```

## Deployment Steps

### Option 1: Environment Variable (Recommended for Render/Production)

If you're using Render or another platform with `DATABASE_URL` set automatically:

1. **Check your Render environment variables**:
   - Go to Render Dashboard → Your Service → Environment
   - Find `DATABASE_URL` or `SUPABASE_CONNECTION_STRING`
   - Check if it uses `:6543` (pooler) or `:5432` (direct)

2. **If it uses :6543, either**:
   - **Option A**: Let the code auto-fix it (already implemented)
   - **Option B**: Manually set it to use `:5432`:
     ```
     DATABASE_URL=postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:5432/postgres
     ```

3. **Restart your service** to apply changes

### Option 2: Manual Configuration

If constructing the connection string from `SUPABASE_DB_PASSWORD`:

1. Ensure these environment variables are set:
   ```bash
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_DB_PASSWORD=your_database_password
   SUPABASE_SERVICE_KEY=your_service_role_key
   ```

2. The code will automatically construct the direct connection URL:
   ```
   postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:5432/postgres
   ```

## Verification

After deploying the fix, you should see these logs on startup:

```
[PostgreSQL] Constructing connection string (direct mode for DDL operations)
[PostgreSQL] Connection pool initialized successfully
[PostgreSQL] Connection test successful!
[PostgreSQL] Server version: PostgreSQL 15.x
[PostgreSQL] Current user: postgres
[PostgreSQL] Current database: postgres
```

## When to Use Each Connection Type

| Connection Type | Port | Use Case | Supports DDL? |
|----------------|------|----------|---------------|
| **Direct Connection** | 5432 | Schema management, DDL operations, long-running queries | ✅ Yes |
| **Transaction Pooler** | 6543 | Short-lived transactions, serverless functions, high concurrency | ❌ No |
| **Session Pooler** | 6543 | Long-running sessions, some DDL support | ⚠️ Limited |

## Related Issues

- [x] "Tenant or user not found" error when creating schemas
- [x] XX000 error code from Supabase pooler
- [x] Schema automation failures on Render deployment
- [x] Connection timeout issues with pooler

## Additional Resources

- [Supabase Pooler Documentation](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pool)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Supabase Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting)

## Testing

To test schema creation after the fix:

1. Go to Admin Panel → Company Management
2. Click "Create New Company"
3. Fill in company details
4. Click "Create Company & Schema"
5. Check server logs for successful schema creation

Expected success logs:
```
[SchemaAutomation] Starting schema creation for: company_c
[PostgreSQL] New client connected to pool
[SchemaAutomation] Creating schema: company_c
[SchemaAutomation] Schema company_c created successfully
[SchemaAutomation] Creating tables in schema: company_c
[SchemaAutomation] All tables created successfully
[Admin] Company and schema created successfully
```

## Troubleshooting

If you still encounter issues:

1. **Check PostgreSQL logs** in Supabase Dashboard → Database → Logs
2. **Verify direct connection** is enabled (port 5432)
3. **Check firewall rules** - ensure port 5432 is accessible
4. **Verify credentials** - ensure `SUPABASE_DB_PASSWORD` is correct
5. **Check connection limits** - Supabase free tier has connection limits

## Summary

The "Tenant or user not found" error was caused by attempting DDL operations through Supabase's transaction pooler (port 6543), which doesn't support schema modifications. The fix forces the use of direct connections (port 5432) for all database operations, which fully supports DDL operations like `CREATE SCHEMA` and `DROP SCHEMA`.
