# Multi-Tenant Supabase Setup Guide

## Overview
This folder contains SQL scripts to set up a multi-tenant architecture with 2 companies (Company A and Company B).

## 📋 What This Setup Does

1. **Deletes** all existing tables in `public` schema (fresh start)
2. **Creates** company registry in `public` schema
3. **Registers** 2 companies:
   - Company A (domain: `company-a.local`)
   - Company B (domain: `company-b.local`)
4. **Creates** 2 isolated schemas with complete table structure:
   - `company_a` schema (6 tables)
   - `company_b` schema (6 tables)

**Total Result:**
- 1 schema: `public` with 1 table (`companies` registry)
- 2 schemas: `company_a` and `company_b` each with 6 tables
- Total: 13 tables across 3 schemas

---

## 🚀 Step-by-Step Execution

### Prerequisites
- Access to Supabase Dashboard
- SQL Editor access
- **IMPORTANT:** Make sure you don't need any existing data (will be deleted!)

---

### STEP 1: Delete Old Tables

**File:** `01-delete-old-tables.sql`

**Action:**
1. Open Supabase Dashboard → SQL Editor
2. Copy entire content of `01-delete-old-tables.sql`
3. Paste into SQL Editor
4. Click **Run**

**What it does:**
- Drops all 6 existing tables: `employees`, `knowledge_base`, `chat_history`, `escalations`, `employee_embeddings`, `analytics`
- Verifies deletion (should return 0 rows)

**Verification:**
```sql
-- Run this to confirm tables are gone
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Should NOT show any of the 6 tables
```

---

### STEP 2: Create Company Registry

**File:** `02-company-registry.sql`

**Action:**
1. In Supabase SQL Editor
2. Copy entire content of `02-company-registry.sql`
3. Paste and click **Run**

**What it does:**
- Creates `public.companies` table (registry)
- Creates helper functions (`validate_schema_name`, `get_company_by_domain`)
- Inserts 2 companies:
  - **Company A**: domain `company-a.local`, schema `company_a`
  - **Company B**: domain `company-b.local`, schema `company_b`

**Verification:**
```sql
-- Run this to see registered companies
SELECT id, name, domain, schema_name, status FROM public.companies;

-- Should show 2 rows:
-- 1. Company A | company-a.local | company_a | active
-- 2. Company B | company-b.local | company_b | active
```

---

### STEP 3: Create Company A Schema

**File:** `03-company-a-schema.sql`

**Action:**
1. In Supabase SQL Editor
2. Copy entire content of `03-company-a-schema.sql`
3. Paste and click **Run**

**What it does:**
- Creates `company_a` schema
- Creates 6 tables: `employees`, `knowledge_base`, `chat_history`, `escalations`, `employee_embeddings`, `analytics`
- Creates indexes (including HNSW vector indexes)
- Creates RPC functions: `match_knowledge`, `match_employees`
- Creates triggers for `updated_at` columns

**Verification:**
```sql
-- Check schema exists
SELECT nspname FROM pg_namespace WHERE nspname = 'company_a';

-- Check tables in schema
SELECT tablename FROM pg_tables WHERE schemaname = 'company_a';

-- Should show 6 tables:
-- employees, knowledge_base, chat_history, escalations, employee_embeddings, analytics
```

---

### STEP 4: Create Company B Schema

**File:** `04-company-b-schema.sql`

**Action:**
1. In Supabase SQL Editor
2. Copy entire content of `04-company-b-schema.sql`
3. Paste and click **Run**

**What it does:**
- Creates `company_b` schema
- Creates same 6 tables as Company A (isolated)
- Creates indexes, RPC functions, triggers

**Verification:**
```sql
-- Check schema exists
SELECT nspname FROM pg_namespace WHERE nspname = 'company_b';

-- Check tables in schema
SELECT tablename FROM pg_tables WHERE schemaname = 'company_b';

-- Should show 6 tables (same as company_a but isolated)
```

---

### STEP 5: Final Verification

**Run these queries to confirm everything is set up correctly:**

```sql
-- 1. Check all schemas
SELECT nspname FROM pg_namespace
WHERE nspname IN ('public', 'company_a', 'company_b');
-- Should show 3 schemas

-- 2. Check company registry
SELECT name, domain, schema_name FROM public.companies;
-- Should show 2 companies

-- 3. Check Company A tables
SELECT tablename FROM pg_tables WHERE schemaname = 'company_a';
-- Should show 6 tables

-- 4. Check Company B tables
SELECT tablename FROM pg_tables WHERE schemaname = 'company_b';
-- Should show 6 tables

-- 5. Test RPC function exists
SELECT proname FROM pg_proc
WHERE pronamespace = 'company_a'::regnamespace
  AND proname = 'match_knowledge';
-- Should return 1 row

-- 6. Verify vector extension
SELECT * FROM pg_extension WHERE extname = 'vector';
-- Should show vector extension enabled
```

---

## 📊 What Your Supabase Looks Like After Setup

### Table Editor View

**Schema Dropdown:**
```
┌──────────────────┐
│ schema: public ▼ │
└──────────────────┘
  ├── public        ← 1 table (companies)
  ├── company_a     ← 6 tables (Company A data)
  └── company_b     ← 6 tables (Company B data)
```

**When you select `public` schema:**
```
Tables:
└── companies  (1 table)
```

**When you select `company_a` schema:**
```
Tables:
├── analytics
├── chat_history
├── employee_embeddings
├── employees
├── escalations
└── knowledge_base
```

**When you select `company_b` schema:**
```
Tables:
├── analytics
├── chat_history
├── employee_embeddings
├── employees
├── escalations
└── knowledge_base
```

---

## 🧪 Testing with Sample Data

### Insert Test Data

```sql
-- Company A: Test Employee
INSERT INTO company_a.employees (employee_id, name, email, policy_type, coverage_limit)
VALUES ('EMP001', 'Alice Anderson', 'alice@company-a.local', 'Premium', 100000.00);

-- Company B: Test Employee
INSERT INTO company_b.employees (employee_id, name, email, policy_type, coverage_limit)
VALUES ('EMP001', 'Bob Brown', 'bob@company-b.local', 'Basic', 50000.00);

-- Verify isolation
SELECT name, email FROM company_a.employees;
-- Should only show Alice

SELECT name, email FROM company_b.employees;
-- Should only show Bob
```

### Test Knowledge Base

```sql
-- Company A: Sample KB entry
INSERT INTO company_a.knowledge_base (title, content, category)
VALUES ('Company A Health Policy', 'Company A provides comprehensive health coverage...', 'policy');

-- Company B: Sample KB entry
INSERT INTO company_b.knowledge_base (title, content, category)
VALUES ('Company B Health Policy', 'Company B offers basic health benefits...', 'policy');

-- Verify isolation
SELECT title FROM company_a.knowledge_base;
-- Should only show Company A policy

SELECT title FROM company_b.knowledge_base;
-- Should only show Company B policy
```

---

## 🔧 Backend Configuration (Next Steps)

After running these SQL scripts, your backend is already configured for multi-tenancy:

1. ✅ **supabase.js**: Already has `createSchemaClient()` and `getSchemaClient()`
2. ✅ **companyContext.js**: Middleware extracts domain and creates schema client
3. ✅ **companySchema.js**: Service functions for company management

### What You Need to Do:

**1. Update hosts file** (for local testing):

**Windows:** `C:\Windows\System32\drivers\etc\hosts`
```
127.0.0.1 localhost
127.0.0.1 company-a.local
127.0.0.1 company-b.local
```

**2. Test API with different domains:**

```bash
# Test Company A
curl http://localhost:3000/api/chat/session \
  -H "Content-Type: application/json" \
  -H "X-Widget-Domain: company-a.local" \
  -d '{"employeeId": "EMP001"}'

# Test Company B
curl http://localhost:3000/api/chat/session \
  -H "Content-Type: application/json" \
  -H "X-Widget-Domain: company-b.local" \
  -d '{"employeeId": "EMP001"}'
```

**3. Upload employees/knowledge base** via admin dashboard for each company

---

## 📝 Domain Mapping

| Domain | Schema | Use Case |
|--------|--------|----------|
| `company-a.local` | `company_a` | Company A testing |
| `www.company-a.local` | `company_a` | Company A www |
| `localhost` | `company_a` | Default (Company A) |
| `company-b.local` | `company_b` | Company B testing |
| `www.company-b.local` | `company_b` | Company B www |

---

## 🔄 Adding More Companies Later

To add a new company:

### Option 1: Via SQL

```sql
-- Step 1: Register company
INSERT INTO public.companies (name, domain, schema_name)
VALUES ('Company C', 'company-c.local', 'company_c');

-- Step 2: Generate schema SQL
-- Copy company-schema-template.sql and replace {{SCHEMA_NAME}} with company_c
-- Then run the generated SQL
```

### Option 2: Via Backend (when admin routes implemented)

```bash
POST /api/admin/companies
{
  "name": "Company C",
  "domain": "company-c.local"
}
```

---

## ⚠️ Important Notes

1. **Data Isolation**: Each company's data is completely isolated in separate schemas
2. **No Cross-Company Access**: Impossible to accidentally query another company's data
3. **Same Structure**: All companies have identical table structure
4. **Independent Indexes**: Each schema has its own vector indexes (better performance)
5. **Scalable**: Can add unlimited companies following the same pattern

---

## 🐛 Troubleshooting

### "Schema does not exist"
**Cause:** SQL script failed or not run
**Fix:** Re-run the schema creation script (03 or 04)

### "Table already exists"
**Cause:** Script run multiple times
**Fix:** Scripts use `IF NOT EXISTS`, safe to re-run

### "Company not found for domain"
**Cause:** Domain not in registry or doesn't match
**Fix:** Check `SELECT * FROM public.companies` and verify domain

### "Function does not exist"
**Cause:** RPC functions not created
**Fix:** Re-run schema creation script

---

## ✅ Setup Complete Checklist

- [ ] Step 1: Old tables deleted
- [ ] Step 2: Company registry created
- [ ] Step 3: Company A schema created
- [ ] Step 4: Company B schema created
- [ ] Verification queries all pass
- [ ] Test data inserted successfully
- [ ] Hosts file updated
- [ ] Backend API tested with both domains
- [ ] Data isolation verified (no cross-company access)

---

## 📞 Support

If you encounter issues:
1. Check verification queries after each step
2. Review Supabase SQL Editor error messages
3. Ensure vector extension is enabled
4. Verify backend environment variables are set

---

**Last Updated:** 2025-10-22
**Status:** Ready for execution
