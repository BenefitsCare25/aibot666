# Multi-Schema Issue Resolution

## Problem History

### Initial Error
```
Error: Could not find the table 'public.company_a.employees'
```
**Cause**: Using table name prefixing (`company_a.employees`) which Supabase interpreted as a table named `company_a.employees` in the `public` schema.

### Second Error (After Exposing Schemas)
```
Error: The schema must be one of the following: public, graphql_public
```
**Cause**: Schemas weren't exposed in Supabase Dashboard → Settings → API.
**Resolution**: Added `company_a, company_b` to "Exposed schemas" ✅

### Third Error (After Using Accept-Profile Headers)
```
Error: Could not find the table 'public.employees'
```
**Cause**: `@supabase/supabase-js` v2 doesn't apply `global.headers` to `.from()` queries - only to RPC, Auth, and Storage operations.

## Final Solution

Use the `db.schema` configuration option in Supabase client initialization:

```javascript
const baseClient = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'company_a'  // Sets the schema for ALL operations
  }
});

// Now this queries company_a.employees
await baseClient.from('employees').select('*');
```

### Why This Works

The `db.schema` option:
1. ✅ Sets the PostgREST schema context for ALL operations
2. ✅ Works with `.from()` table queries
3. ✅ Works with `.rpc()` function calls
4. ✅ Properly routes to the correct PostgreSQL schema
5. ✅ Respects the "Exposed schemas" configuration

## Requirements Checklist

- [x] Schemas created in PostgreSQL (`company_a`, `company_b`)
- [x] Tables and functions in each schema
- [x] Permissions granted to Supabase roles (anon, authenticated, service_role)
- [x] Schemas exposed in Supabase Dashboard → Settings → API → "Exposed schemas"
- [x] Supabase client uses `db.schema` configuration
- [x] Company middleware routes requests to correct schema

## Testing

After deployment, you should see logs like:
```
[Supabase] Creating schema client for: company_b
[Supabase] Client configured with db.schema=company_b
[Supabase] Querying table: employees in schema: company_b
✅ Session created successfully
```

## Architecture Flow

```
1. User visits widget on company-b.local
2. Widget sends X-Widget-Domain: company-b.local header
3. companyContextMiddleware extracts domain
4. Looks up company in companies table → finds schema_name: company_b
5. Creates Supabase client with db.schema: company_b
6. All queries route to company_b schema
7. Returns company_b.employees, company_b.knowledge_base, etc.
```

## Key Learnings

1. **Supabase Schema Access**: Requires both permissions AND exposure in API settings
2. **Header Limitations**: `global.headers` don't apply to `.from()` queries in JS client v2
3. **Correct Approach**: Use `db.schema` config option, not manual table prefixing
4. **Schema Isolation**: Each company's data is completely isolated in separate schemas
