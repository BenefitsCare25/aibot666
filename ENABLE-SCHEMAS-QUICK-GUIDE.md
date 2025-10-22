# Quick Guide: Enable Multi-Tenant Schemas in Supabase

## Step 1: Run SQL Permissions (5 minutes)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste all content from: `backend/config/supabase-setup/06-enable-api-schemas.sql`
3. Click **Run**
4. You should see results showing your schemas and tables

## Step 2: Expose Schemas in API Settings (2 minutes)

1. Go to **Settings** → **API** (in left sidebar)
2. Scroll to **"Exposed schemas"** section
3. You'll see a text field with `public` (default)
4. **Change it to**: `public,company_a,company_b`
5. Click **Save**

## Step 3: Restart Your Backend (1 minute)

Render will auto-deploy from GitHub, or manually restart:
- Go to Render Dashboard → Your Service → **Manual Deploy** → **Clear build cache & deploy**

## Step 4: Test

After deployment, test the chatbot widget:
- Admin dashboard should now work without "Company not found" error
- Employee login (EMP001) should create session successfully
- Check Render logs for: `[POST] /session - Company: Company A (company_a)` ✅

## Troubleshooting

### Still getting "schema must be one of..."?
- **Check**: Did you add `company_a,company_b` to Exposed schemas?
- **Restart**: Clear Supabase cache or wait 1-2 minutes for changes to propagate

### Still getting "could not find table"?
- **Run SQL**: Make sure 06-enable-api-schemas.sql completed without errors
- **Verify**: Run `SELECT * FROM company_a.employees LIMIT 1;` in SQL Editor

### Permission denied errors?
- **Check roles**: The SQL grants to `anon, authenticated, service_role`
- **Verify API key**: Make sure you're using `SUPABASE_SERVICE_KEY` not `SUPABASE_ANON_KEY`

## What This Does

**Before**: PostgREST only knows about `public` schema
- ❌ `company_a.employees` → Not found
- ❌ Accept-Profile: company_a → Rejected

**After**: PostgREST recognizes all exposed schemas
- ✅ `company_a.employees` → Found
- ✅ Accept-Profile: company_a → Routes to company_a schema
- ✅ Multi-tenant isolation working

## Expected Result

```
Domain from X-Widget-Domain header: company-a.local
[DB Lookup] Company found: Company A (company_a)
[POST] /session - Company: Company A (company_a)
✅ Session created successfully
```
