# Quick Start: Database Migration

## ✅ Company Creation Already Updated

**Good news!** The company creation function automatically uses the updated schema template (`company-schema-template.sql`), so **new companies will have all 4 new columns automatically**.

- File: `backend/api/services/schemaAutomation.js` (line 168)
- Reads from: `backend/config/company-schema-template.sql` ✅ (already updated)

**This means:**
- Any new companies created after deployment will have the new columns
- No manual intervention needed for future companies

---

## 📝 Manual Migration for Existing Companies

For **existing companies** in Supabase, you need to run the migration SQL.

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New query**

### Step 2: Copy the Migration SQL

**Option A: Copy from file** (Recommended)
- Open: `backend/migrations/MANUAL_MIGRATION_QUERIES.sql`
- Copy the entire file content
- Paste into Supabase SQL Editor

**Option B: Use the script below**

```sql
-- Copy from here ↓
DO $$
DECLARE
    schema_record RECORD;
    affected_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting Employee Lifecycle Migration at: %', NOW();
    RAISE NOTICE '';

    FOR schema_record IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN (
            'pg_catalog', 'information_schema', 'pg_toast', 'public',
            'extensions', 'auth', 'storage', 'graphql_public',
            'realtime', 'supabase_functions', 'vault', 'pgsodium'
        )
        AND schema_name NOT LIKE 'pg_%'
        ORDER BY schema_name
    LOOP
        BEGIN
            RAISE NOTICE 'Processing schema: %', schema_record.schema_name;

            -- Add is_active column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true',
                schema_record.schema_name
            );

            -- Add deactivated_at column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL',
                schema_record.schema_name
            );

            -- Add deactivated_by column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivated_by VARCHAR(255) DEFAULT NULL',
                schema_record.schema_name
            );

            -- Add deactivation_reason column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivation_reason TEXT DEFAULT NULL',
                schema_record.schema_name
            );

            -- Create index
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_%I_employees_is_active ON %I.employees(is_active)',
                schema_record.schema_name,
                schema_record.schema_name
            );

            -- Update existing employees to active
            EXECUTE format(
                'UPDATE %I.employees SET is_active = true WHERE is_active IS NULL',
                schema_record.schema_name
            );

            affected_count := affected_count + 1;
            RAISE NOTICE '  ✅ Completed: %', schema_record.schema_name;

        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE WARNING '  ❌ Failed: % - %', schema_record.schema_name, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration Summary';
    RAISE NOTICE 'Successfully updated: % schemas', affected_count;
    RAISE NOTICE 'Failed: % schemas', error_count;
    RAISE NOTICE 'Completed at: %', NOW();
    RAISE NOTICE '========================================';
END $$;
-- Copy to here ↑
```

### Step 3: Run the Migration

1. Click **Run** (or press Ctrl/Cmd + Enter)
2. Wait for completion (usually < 1 minute)
3. Check the **Results** panel for success messages

**Expected Output:**
```
NOTICE: Starting Employee Lifecycle Migration at: 2025-11-19 ...
NOTICE: Processing schema: company_a
NOTICE:   ✅ Completed: company_a
NOTICE: Processing schema: company_b
NOTICE:   ✅ Completed: company_b
...
NOTICE: Successfully updated: 5 schemas
NOTICE: Failed: 0 schemas
```

### Step 4: Verify Migration Success

Run this verification query:

```sql
-- Check which schemas have the new columns
SELECT
    table_schema,
    COUNT(*) as new_columns_count
FROM information_schema.columns
WHERE table_name = 'employees'
AND column_name IN ('is_active', 'deactivated_at', 'deactivated_by', 'deactivation_reason')
GROUP BY table_schema
ORDER BY table_schema;
```

**Expected Result:** Each schema should show `new_columns_count = 4`

---

## ⚠️ Important Notes

### Safe to Run Multiple Times
- Uses `ADD COLUMN IF NOT EXISTS` - won't fail if columns already exist
- Uses `CREATE INDEX IF NOT EXISTS` - won't fail if index already exists
- Safe to re-run if migration is interrupted

### What If Migration Fails for a Schema?

If you see a failure notice for a specific schema:

1. Check the error message in the output
2. Run this to check the schema manually:
   ```sql
   \d your_schema_name.employees
   ```
3. If needed, add columns manually:
   ```sql
   ALTER TABLE your_schema_name.employees
   ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
   ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
   ADD COLUMN IF NOT EXISTS deactivated_by VARCHAR(255) DEFAULT NULL,
   ADD COLUMN IF NOT EXISTS deactivation_reason TEXT DEFAULT NULL;

   CREATE INDEX IF NOT EXISTS idx_your_schema_name_employees_is_active
   ON your_schema_name.employees(is_active);

   UPDATE your_schema_name.employees SET is_active = true WHERE is_active IS NULL;
   ```

### Rollback (If Needed)

If you need to undo the migration:

```sql
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'public')
        AND schema_name NOT LIKE 'pg_%'
    LOOP
        EXECUTE format('ALTER TABLE %I.employees DROP COLUMN IF EXISTS is_active', schema_record.schema_name);
        EXECUTE format('ALTER TABLE %I.employees DROP COLUMN IF EXISTS deactivated_at', schema_record.schema_name);
        EXECUTE format('ALTER TABLE %I.employees DROP COLUMN IF EXISTS deactivated_by', schema_record.schema_name);
        EXECUTE format('ALTER TABLE %I.employees DROP COLUMN IF EXISTS deactivation_reason', schema_record.schema_name);
        RAISE NOTICE 'Rolled back: %', schema_record.schema_name;
    END LOOP;
END $$;
```

---

## 🚀 After Migration

Once migration is successful:

1. **Deploy code to Render** (push to Git)
2. **Test the features:**
   - Status filter in admin UI
   - Excel upload with sync mode
   - Deactivated employee cannot access chatbot ⚠️ **CRITICAL TEST**

3. **Monitor logs** for 24-48 hours

---

## Summary

✅ **New companies:** Auto-get new columns (no action needed)
📝 **Existing companies:** Run migration SQL once
🔄 **Safe to re-run:** Won't break if run multiple times
⏱️ **Time required:** < 1 minute for most databases

**Files to reference:**
- Full migration: `backend/migrations/MANUAL_MIGRATION_QUERIES.sql`
- Verification queries: Same file, bottom section
- Deployment guide: `claudedocs/DEPLOYMENT_GUIDE.md`
