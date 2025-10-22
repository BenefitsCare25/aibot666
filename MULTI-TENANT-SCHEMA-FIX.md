# Multi-Tenant Schema Routing Fix

## Problem Summary

The application was experiencing data loading issues across all pages because:
1. **Telegram bot** couldn't find escalations (error: "Could not find the table 'public.escalations'")
2. **Admin panel pages** weren't loading data correctly
3. **Root cause**: Routes were using the default Supabase client targeting `public` schema instead of company-specific schemas like `company_a`

## Architecture Overview

### Multi-Tenant Schema Design
```
public schema (PostgreSQL default)
├── companies table (tenant registry)
├── ...admin tables...

company_a schema (Tenant 1)
├── employees
├── knowledge_base
├── chat_history
├── escalations

company_b schema (Tenant 2)
├── employees
├── knowledge_base
├── chat_history
├── escalations
```

### Request Flow

```
Frontend Request
    ↓
[X-Widget-Domain header: company-a.com]
    ↓
companyContextMiddleware
    ↓
  1. Extract domain from headers
  2. Lookup company in public.companies
  3. Get schema_name (e.g., "company_a")
  4. Create schema-specific Supabase client
  5. Attach to req.supabase and req.company
    ↓
Route Handler uses req.supabase
    ↓
Queries go to correct schema (company_a.employees, etc.)
```

## Changes Made

### 1. Telegram Bot Schema Routing (`backend/api/services/telegram.js`)

**Before:**
```javascript
// Always used public schema
import supabase from '../../config/supabase.js';

const { data: escalation } = await supabase
  .from('escalations')  // ❌ Looked in public.escalations
  .select('*')
  .eq('id', escalationId)
  .single();
```

**After:**
```javascript
// Extracts schema from Telegram message and uses correct client
const escalationIdMatch = replyToText.match(/\[Escalation: ([a-f0-9-]+)(?:\|Schema: ([a-z0-9_]+))?\]/);
const schemaName = escalationIdMatch[2]; // 'company_a'

const { getSchemaClient } = await import('../../config/supabase.js');
const schemaClient = getSchemaClient(schemaName);

const { data: escalation } = await schemaClient
  .from('escalations')  // ✅ Queries company_a.escalations
  .select('*')
  .eq('id', escalationId)
  .single();
```

**Telegram Message Format:**
```
Old: [Escalation: 52e559d5-bc26-4ab2-afd7-4e65f800085f]
New: [Escalation: 52e559d5-bc26-4ab2-afd7-4e65f800085f|Schema: company_a]
```

### 2. Chat Routes Schema Routing (`backend/api/routes/chat.js`)

**Before:**
```javascript
// No middleware, unclear schema routing
```

**After:**
```javascript
import { companyContextMiddleware } from '../middleware/companyContext.js';

const router = express.Router();

// Apply company context middleware to all chat routes
router.use(companyContextMiddleware);

// All handlers now use req.supabase (schema-specific client)
router.post('/message', async (req, res) => {
  // req.company.schemaName available
  // req.supabase queries correct schema
  const { data: employee } = await req.supabase
    .from('employees')  // ✅ Queries company_a.employees
    .select('*')
    .eq('id', session.employeeId)
    .single();

  // Pass schema to Telegram for escalations
  await notifyTelegramEscalation(
    escalation, query, employee, response,
    recentMessages,
    req.company.schemaName  // ✅ Pass 'company_a'
  );
});
```

### 3. Admin Routes Schema Routing (`backend/api/routes/admin.js`)

**Before:**
```javascript
import supabase from '../../config/supabase.js';  // Default public schema

router.get('/employees', async (req, res) => {
  let query = supabase  // ❌ Always queried public.employees
    .from('employees')
    .select('*', { count: 'exact' });
  // ...
});

router.get('/escalations', async (req, res) => {
  let query = supabase  // ❌ Always queried public.escalations
    .from('escalations')
    .select(`*, employees (name, email, policy_type)`);
  // ...
});
```

**After:**
```javascript
import { companyContextMiddleware, adminContextMiddleware } from '../middleware/companyContext.js';

const router = express.Router();

// Company management routes use public schema
router.use('/companies', adminContextMiddleware);

// All other routes use company-specific schema
router.use((req, res, next) => {
  if (req.path.startsWith('/companies')) {
    return next();
  }
  return companyContextMiddleware(req, res, next);
});

router.get('/employees', async (req, res) => {
  let query = req.supabase  // ✅ Queries company_a.employees
    .from('employees')
    .select('*', { count: 'exact' });
  // ...
});

router.get('/escalations', async (req, res) => {
  let query = req.supabase  // ✅ Queries company_a.escalations
    .from('escalations')
    .select(`*, employees (name, email, policy_type)`);
  // ...
});

router.get('/analytics', async (req, res) => {
  let chatQuery = req.supabase  // ✅ Queries company_a.chat_history
    .from('chat_history')
    .select('employee_id, created_at, was_escalated, confidence_score, role');

  const { data: escalations } = await req.supabase  // ✅ Queries company_a.escalations
    .from('escalations')
    .select('status, created_at, resolved_at');
  // ...
});
```

### 4. Frontend API Client (`frontend/admin/src/api/client.js`)

**Already Correct:**
```javascript
// Request interceptor adds company domain header
apiClient.interceptors.request.use((config) => {
  const selectedCompany = localStorage.getItem('selected_company_domain');
  if (selectedCompany) {
    config.headers['X-Widget-Domain'] = selectedCompany;  // ✅ Sends domain
  }
  return config;
});
```

## Updated Routes

### Routes Using Company-Specific Schema

All these routes now use `req.supabase` which targets the company schema:

**Employee Routes:**
- `GET /api/admin/employees` - List employees
- `GET /api/admin/employees/:id` - Get employee details
- `POST /api/admin/employees` - Add employee
- `POST /api/admin/employees/upload` - Upload Excel

**Knowledge Base Routes:**
- `GET /api/admin/knowledge` - List knowledge entries
- `POST /api/admin/knowledge` - Add entry
- `POST /api/admin/knowledge/batch` - Bulk add
- `PUT /api/admin/knowledge/:id` - Update entry
- `DELETE /api/admin/knowledge/:id` - Delete entry

**Escalation Routes:**
- `GET /api/admin/escalations` - List escalations
- `PATCH /api/admin/escalations/:id` - Update escalation

**Analytics Routes:**
- `GET /api/admin/analytics` - Get usage statistics

**Chat Routes:**
- `POST /api/chat/session` - Create session
- `POST /api/chat/message` - Send message
- `GET /api/chat/history/:conversationId` - Get history

### Routes Using Public Schema

These routes use `req.supabase` from `adminContextMiddleware` targeting public schema:

**Company Management:**
- `GET /api/admin/companies` - List companies
- `GET /api/admin/companies/:id` - Get company
- `POST /api/admin/companies` - Create company
- `PUT /api/admin/companies/:id` - Update company
- `DELETE /api/admin/companies/:id` - Delete company

## Testing Checklist

### Frontend Testing
- [ ] Login to admin panel
- [ ] Select company from dropdown (e.g., "Acme Inc - company-a.com")
- [ ] Navigate to Employees page - should show company_a employees
- [ ] Navigate to Knowledge Base - should show company_a knowledge entries
- [ ] Navigate to Escalations - should show company_a escalations
- [ ] Navigate to Analytics - should show company_a statistics
- [ ] Switch to different company - data should reload with new company's data

### Telegram Testing
- [ ] Ask question that triggers escalation in widget
- [ ] Check Telegram for notification with format: `[Escalation: <id>|Schema: company_a]`
- [ ] Reply "correct" or custom answer to escalation
- [ ] Verify escalation is marked as resolved in company_a.escalations
- [ ] Verify no "table not found" errors in Render logs

### API Testing (with curl or Postman)
```bash
# Test with company header
curl -H "X-Widget-Domain: company-a.com" \
     http://localhost:3000/api/admin/employees

# Should return employees from company_a schema
```

## Deployment Notes

1. **Environment Variables**: No new environment variables needed
2. **Database Migrations**: No schema changes required (schemas already exist)
3. **Backward Compatibility**:
   - Old Telegram messages without schema info default to `public` schema
   - Frontend already sends `X-Widget-Domain` header
4. **Monitoring**: Watch Render logs for any "table not found" errors

## Debugging

### Check Current Schema in Logs
```
[Supabase] Creating schema client for: company_a
[Supabase] Client configured with db.schema=company_a
[Supabase] Querying table: employees in schema: company_a
```

### Verify Company Context
```
[GET] /api/admin/employees - Company: Acme Inc (company_a)
```

### Common Issues

**Issue**: "Could not find the table 'public.tablename' in the schema cache"
**Fix**: Verify `X-Widget-Domain` header is being sent and middleware is applied

**Issue**: No data showing in admin panel
**Fix**: Check browser localStorage for `selected_company_domain` value

**Issue**: Telegram replies fail
**Fix**: Verify escalation message includes `|Schema: company_a` format

## Files Changed

### Backend
- `backend/api/routes/admin.js` - Added middleware, updated all handlers to use `req.supabase`
- `backend/api/routes/chat.js` - Added middleware, pass schema to Telegram
- `backend/api/services/telegram.js` - Extract schema from messages, use dynamic schema client

### Frontend
- No changes needed (already sending `X-Widget-Domain`)

### Configuration
- `backend/config/supabase.js` - No changes (schema client creation already implemented)
- `backend/api/middleware/companyContext.js` - No changes (middleware already implemented)

## Summary

✅ **Fixed**: Telegram bot can now find and update escalations in company-specific schemas
✅ **Fixed**: Admin panel loads data from correct company schema based on selected company
✅ **Fixed**: Chat routes use company-specific schema for all operations
✅ **Fixed**: Analytics show company-specific metrics
✅ **Maintained**: Company management routes correctly use public schema

All routes now respect the multi-tenant architecture and query data from the correct PostgreSQL schema based on the company context.
