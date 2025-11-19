# Employee Lifecycle Solution - Deployment Guide

## Production Deployment Steps for Render

### Pre-Deployment Checklist

- [ ] All code changes committed to Git
- [ ] Frontend builds successfully
- [ ] Backend syntax validated
- [ ] Database migration script prepared

### Step 1: Database Migration

**IMPORTANT: Run this BEFORE deploying code changes**

1. Connect to your Supabase database:
   ```bash
   psql -h your-supabase-host -U postgres -d postgres
   ```

2. Run the migration script:
   ```bash
   \i backend/migrations/add-employee-status.sql
   ```

3. Verify migration success:
   ```sql
   -- Check one of your company schemas
   \d your_company_schema.employees
   -- Should show new columns: is_active, deactivated_at, deactivated_by, deactivation_reason
   ```

### Step 2: Deploy Backend to Render

1. **Push code to Git repository:**
   ```bash
   git add .
   git commit -m "Implement employee lifecycle management with soft delete"
   git push origin main
   ```

2. **Render will auto-deploy** (if auto-deploy is enabled)
   - Monitor the deployment logs in Render dashboard
   - Ensure build completes successfully
   - Check backend health endpoint

3. **Manual deploy** (if auto-deploy is disabled):
   - Go to Render dashboard → Your backend service
   - Click "Manual Deploy" → "Deploy latest commit"

### Step 3: Deploy Frontend to Render

1. **Push code to Git repository** (if not already done):
   ```bash
   git push origin main
   ```

2. **Render will auto-deploy** (if auto-deploy is enabled)
   - Monitor build logs
   - Verify build completes without errors

3. **Verify deployment:**
   - Access your admin frontend URL
   - Check that Employees page loads correctly
   - Verify new UI elements appear:
     - Status filter dropdown (Active/Inactive/All)
     - Sync mode checkbox in upload section

### Step 4: Verification Testing

#### Test 1: Database Schema
```sql
-- Verify columns exist in all company schemas
SELECT schema_name FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'public')
AND schema_name NOT LIKE 'pg_%';

-- For each schema, check:
\d your_company_schema.employees
```

#### Test 2: Employee Status Filter
1. Log into admin dashboard
2. Navigate to Employees page
3. Test status filter dropdown:
   - Select "Active Employees" (should show only active)
   - Select "Inactive Employees" (should show none initially)
   - Select "All Employees" (should show all)

#### Test 3: Excel Upload with Sync Mode
1. Download employee template
2. Add a few test employees
3. Upload with:
   - [x] Update existing employees
   - [x] Sync mode
4. Verify results show: imported, updated, deactivated counts

#### Test 4: Employee Deactivation (Critical - Access Control)
1. Create a test employee via admin
2. Note the employee_id
3. Try to access chatbot with employee_id → Should work
4. Deactivate the employee via admin (or upload Excel without that employee with sync mode)
5. Try to access chatbot with same employee_id → Should fail with "Active employee not found"
6. Verify in database: `is_active = false`, `deactivated_at` populated

#### Test 5: Data Preservation
1. Create employee with chat history
2. Deactivate the employee
3. Check database:
   ```sql
   -- Employee still exists
   SELECT * FROM employees WHERE employee_id = 'TEST001';

   -- Chat history preserved
   SELECT COUNT(*) FROM chat_history WHERE employee_id = (
     SELECT id FROM employees WHERE employee_id = 'TEST001'
   );
   ```
4. Reactivate employee
5. Verify all data still intact

### Step 5: Rollback Plan (If Needed)

If issues are discovered after deployment:

1. **Code Rollback:**
   ```bash
   git revert HEAD
   git push origin main
   ```
   Render will auto-deploy the previous version.

2. **Database Rollback:**
   ```sql
   -- For each company schema, remove new columns
   ALTER TABLE schema_name.employees DROP COLUMN IF EXISTS is_active;
   ALTER TABLE schema_name.employees DROP COLUMN IF EXISTS deactivated_at;
   ALTER TABLE schema_name.employees DROP COLUMN IF EXISTS deactivated_by;
   ALTER TABLE schema_name.employees DROP COLUMN IF EXISTS deactivation_reason;
   ```

3. **Template Rollback:**
   Update `backend/config/company-schema-template.sql` to remove the new columns.

### Step 6: Post-Deployment Monitoring

Monitor for 24-48 hours:

1. **Check logs for errors:**
   - Render backend logs
   - Supabase logs
   - Frontend error tracking (if configured)

2. **Monitor employee access:**
   - Verify active employees can access chatbot
   - Verify inactive employees are blocked
   - Check for unexpected authentication failures

3. **Monitor database:**
   - Check `deactivated_at` timestamps
   - Verify no unintended deactivations

### Environment Variables

No new environment variables required. Existing configuration works.

### Known Issues and Solutions

**Issue 1: Migration fails on specific schema**
- Solution: Check schema permissions, run migration manually for that schema

**Issue 2: Frontend shows sync mode but backend doesn't support it**
- Solution: Verify backend deployment completed, check API version

**Issue 3: All employees showing as active despite deactivation**
- Solution: Clear browser cache, verify database migration ran successfully

## Files Modified

### Backend
- `backend/config/company-schema-template.sql` - Added status columns
- `backend/migrations/add-employee-status.sql` - Migration script
- `backend/api/services/vectorDB.js` - Added soft delete functions
- `backend/api/services/excel.js` - Added sync mode support
- `backend/api/routes/admin.js` - Added status management endpoints

### Frontend
- `frontend/admin/src/pages/Employees.jsx` - Added UI for status management
- `frontend/admin/src/api/employees.js` - Added API client functions

## New API Endpoints

- `GET /api/admin/employees?status=active|inactive|all` - Filter by status
- `PATCH /api/admin/employees/:id/deactivate` - Deactivate employee
- `PATCH /api/admin/employees/:id/reactivate` - Reactivate employee
- `POST /api/admin/employees/bulk-deactivate` - Bulk deactivate

## Support

For issues during deployment:
1. Check Render deployment logs
2. Check Supabase database logs
3. Verify migration completed successfully
4. Test API endpoints directly using Postman/curl
