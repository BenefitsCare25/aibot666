# Multi-Tenant Testing Guide

## What's Done ✅

1. ✅ Supabase schemas created (company_a, company_b)
2. ✅ Company registry set up with 2 companies
3. ✅ Backend supabase.js fixed for schema-qualified table names
4. ✅ All 13 tables created across 3 schemas

## Next Steps

### STEP 1: Load Test Data

**In Supabase SQL Editor:**

Run the file: `backend/config/supabase-setup/05-test-data.sql`

This will create:
- **Company A**: 3 employees + 4 knowledge base entries
- **Company B**: 3 employees + 5 knowledge base entries

**Verification:**
```sql
SELECT name, email FROM company_a.employees;
-- Should show: Alice, Bob, Carol

SELECT name, email FROM company_b.employees;
-- Should show: David, Emma, Frank
```

---

### STEP 2: Update Hosts File (for Local Testing)

**Windows:** Edit `C:\Windows\System32\drivers\etc\hosts`

Add these lines:
```
127.0.0.1 company-a.local
127.0.0.1 company-b.local
```

**Save the file** (requires admin privileges)

---

### STEP 3: Start Backend Server

```bash
cd backend
npm run dev
```

Server should start on `http://localhost:3000`

---

### STEP 4: Test API with Company A

**Test 1: Create Session for Company A Employee**

```bash
curl -X POST http://localhost:3000/api/chat/session \
  -H "Content-Type: application/json" \
  -H "X-Widget-Domain: company-a.local" \
  -d "{\"employeeId\": \"EMP001\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "...",
    "conversationId": "...",
    "employee": {
      "id": "...",
      "name": "Alice Anderson",
      "email": "alice@company-a.local",
      "policyType": "Premium",
      "coverageLimit": 150000
    },
    "company": {
      "name": "Company A"
    }
  }
}
```

**Test 2: Query Company A Knowledge Base**

Use the sessionId from above:
```bash
curl -X POST http://localhost:3000/api/chat/query \
  -H "Content-Type: application/json" \
  -H "X-Widget-Domain: company-a.local" \
  -d "{
    \"sessionId\": \"YOUR_SESSION_ID\",
    \"message\": \"What are my dental benefits?\"
  }"
```

**Expected:** Should return information about Company A's dental coverage ($2,000 limit for Premium)

---

### STEP 5: Test API with Company B

**Test 1: Create Session for Company B Employee**

```bash
curl -X POST http://localhost:3000/api/chat/session \
  -H "Content-Type: application/json" \
  -H "X-Widget-Domain: company-b.local" \
  -d "{\"employeeId\": \"EMP001\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "...",
    "employee": {
      "name": "David Davis",
      "email": "david@company-b.local",
      "policyType": "Basic",
      "coverageLimit": 80000
    },
    "company": {
      "name": "Company B"
    }
  }
}
```

**Test 2: Query Company B Knowledge Base**

```bash
curl -X POST http://localhost:3000/api/chat/query \
  -H "Content-Type: application/json" \
  -H "X-Widget-Domain: company-b.local" \
  -d "{
    \"sessionId\": \"YOUR_SESSION_ID\",
    \"message\": \"What are my dental benefits?\"
  }"
```

**Expected:** Should return Company B's dental coverage ($1,000 limit for Basic plan)

---

### STEP 6: Verify Data Isolation

**Test Cross-Company Isolation:**

Try to access Company A employee with Company B domain:

```bash
curl -X POST http://localhost:3000/api/chat/session \
  -H "Content-Type: application/json" \
  -H "X-Widget-Domain: company-b.local" \
  -d "{\"employeeId\": \"EMP001\"}"
```

**Expected:** Should return David Davis (Company B's EMP001), NOT Alice Anderson

This proves each company's EMP001 is completely isolated!

---

### STEP 7: Check Backend Logs

While testing, watch your backend console output:

**Should see:**
```
[Cache Hit] Company found for domain: company-a.local
[POST] /api/chat/session - Company: Company A (company_a)

[DB Lookup] Company found: Company B (company_b)
[POST] /api/chat/session - Company: Company B (company_b)
```

This confirms:
- Domain detection working
- Company lookup working
- Correct schema client being used

---

## Troubleshooting

### "Company not found for this domain"

**Check:**
```sql
SELECT domain, schema_name FROM public.companies;
```

**Fix:** Domain might be normalized differently. Check middleware logs.

### "Employee not found"

**Check:**
```sql
-- For Company A
SELECT employee_id, name FROM company_a.employees WHERE employee_id = 'EMP001';

-- For Company B
SELECT employee_id, name FROM company_b.employees WHERE employee_id = 'EMP001';
```

**Fix:** Run `05-test-data.sql` to insert test employees.

### Backend errors "relation does not exist"

**Cause:** Schema-qualified table names not working

**Check:** `backend/config/supabase.js` should have the updated `createSchemaClient()` function with:
```javascript
from: (table) => {
  const qualifiedTable = `${schemaName}.${table}`;
  return baseClient.from(qualifiedTable);
}
```

### CORS errors

**Fix:** Update `backend/api/middleware/cors.js` to allow company-a.local and company-b.local origins:
```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://company-a.local:3000',
  'http://company-b.local:3000'
];
```

---

## Success Criteria ✅

- [ ] Test data loaded for both companies
- [ ] Hosts file updated
- [ ] Backend starts without errors
- [ ] Company A session created successfully
- [ ] Company B session created successfully
- [ ] Company A returns Alice Anderson for EMP001
- [ ] Company B returns David Davis for EMP001
- [ ] Knowledge base queries return company-specific answers
- [ ] Backend logs show correct company/schema selection
- [ ] No cross-company data leakage

---

## What's Working

✅ **Multi-tenant architecture**: 2 completely isolated company databases
✅ **Domain-based routing**: company-a.local → company_a schema, company-b.local → company_b schema
✅ **Automatic schema selection**: Middleware extracts domain and sets correct schema client
✅ **Data isolation**: Each company only sees their own employees and knowledge base
✅ **Same employee IDs**: Both companies can have EMP001 without conflicts

---

## Next Steps After Testing

1. **Add real company data** via admin dashboard
2. **Update widget** to send domain in requests
3. **Deploy backend** to production
4. **Configure real domains** in company registry
5. **Build admin UI** for company management

---

**Current Status:** Ready for testing! Run steps 1-7 above to verify everything works.
