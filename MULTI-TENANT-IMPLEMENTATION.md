# Multi-Tenant Implementation Guide

## Overview
This document explains the multi-company/multi-tenant architecture implemented for the AI Insurance Chatbot. The system now supports multiple companies with complete data isolation using PostgreSQL schemas.

## Architecture Summary

### Design: Single Supabase with Schema-per-Company
- **Single Supabase project** with multiple PostgreSQL schemas
- **Domain-based identification**: Widget detects parent domain to determine company
- **Complete data isolation**: Each company has its own schema with all tables
- **Cost-effective**: Single Supabase billing, easier management than separate projects

```
Widget Embed (company-a.com) → Backend API → Domain Mapping → company_a schema
Widget Embed (company-b.com) → Backend API → Domain Mapping → company_b schema
Widget Embed (company-c.com) → Backend API → Domain Mapping → company_c schema
```

## Implementation Components

### 1. Database Schema Files

#### `backend/config/company-registry.sql`
Creates the company registry in the `public` schema:
- **companies** table: Stores company info, domain mappings, schema names
- **Functions**: `get_company_by_domain()`, `validate_schema_name()`
- **Indexes**: Fast domain lookups with caching support

**Key Fields:**
- `domain`: Primary domain (e.g., "company-a.com")
- `additional_domains`: Array of additional domains
- `schema_name`: PostgreSQL schema name (e.g., "company_a")
- `status`: active/inactive/suspended
- `settings`: JSONB for company-specific configuration

#### `backend/config/company-schema-template.sql`
Template for creating company-specific schemas:
- All tables: employees, knowledge_base, chat_history, escalations, etc.
- Vector indexes for RAG similarity search
- Company-specific RPC functions: `match_knowledge()`, `match_employees()`
- Replace `{{SCHEMA_NAME}}` placeholder with actual schema name

### 2. Backend Services

#### `backend/api/services/companySchema.js`
Company management service with functions:
- `registerCompany(companyData)`: Register new company
- `getCompanyByDomain(domain)`: Lookup company by domain
- `generateSchemaName(companyName)`: Create valid schema name
- `generateSchemaSQL(schemaName)`: Generate SQL for schema creation
- `getAllCompanies()`, `updateCompany()`, `deleteCompany()`

#### `backend/config/supabase.js` (Modified)
Enhanced with multi-tenancy support:
- `createSchemaClient(schemaName)`: Create schema-specific Supabase client
- `getSchemaClient(schemaName)`: Get cached schema client
- `clearSchemaClientCache()`: Clear client cache
- Schema clients stored in cache for performance

#### `backend/api/services/vectorDB.js` (Modified)
Updated functions to accept `supabaseClient` parameter:
- `searchKnowledgeBase(query, supabaseClient, ...)`
- `getEmployeeByEmployeeId(employeeId, supabaseClient)`
- All functions now support multi-tenancy

### 3. Middleware

#### `backend/api/middleware/companyContext.js`
Domain extraction and company resolution middleware:

**Domain Extraction Priority:**
1. Request body `domain` field (from widget)
2. `X-Widget-Domain` custom header
3. `Origin` header (CORS)
4. `Referer` header
5. `Host` header (fallback)

**Functionality:**
- Extracts domain from request
- Looks up company from registry (with Redis caching)
- Sets company-specific Supabase client on `req.supabase`
- Adds company context to `req.company`
- Returns 404 if company not found
- Returns 403 if company inactive

### 4. Routes

#### `backend/api/routes/chat.js` (Modified)
All chat routes now use company context:
- Middleware applied: `router.use(companyContextMiddleware)`
- Uses `req.supabase` (company-specific client) instead of global `supabase`
- All database operations scoped to company schema
- Session response includes company name

### 5. Widget (To Be Modified)

#### `frontend/widget/src/embed.js`
**Needs Update:**
- Detect parent domain using `window.location.ancestorOrigins[0]` or `document.referrer`
- Send domain in session creation API call
- Include domain in all subsequent API requests

## Setup Instructions

### Step 1: Initialize Company Registry

Execute in Supabase SQL Editor:
```sql
-- Run this first to create the registry
\i backend/config/company-registry.sql
```

This creates:
- `public.companies` table
- Helper functions
- Default company for localhost

### Step 2: Register Your First Company

**Option A: Via SQL**
```sql
INSERT INTO public.companies (name, domain, schema_name, status)
VALUES (
  'Acme Corporation',
  'acme.com',
  'company_acme',
  'active'
);
```

**Option B: Via API** (after implementing admin routes)
```javascript
POST /api/admin/companies
{
  "name": "Acme Corporation",
  "domain": "acme.com",
  "additionalDomains": ["www.acme.com", "portal.acme.com"],
  "settings": {
    "brandColor": "#FF0000",
    "features": ["escalation", "analytics"]
  }
}
```

### Step 3: Create Company Schema

1. Get the generated SQL:
```javascript
// From companySchema.js
const sql = generateSchemaSQL('company_acme');
```

2. Execute in Supabase SQL Editor:
```sql
-- Paste the generated SQL here
-- It will create schema company_acme with all tables
```

### Step 4: Configure Widget

Update widget initialization to send domain:
```html
<script src="https://your-domain.com/widget.iife.js"></script>
<script>
  InsuranceChatWidget.init({
    apiUrl: 'https://your-api.onrender.com',
    position: 'bottom-right',
    primaryColor: '#3b82f6',
    // Domain will be auto-detected from parent window
  });
</script>
```

### Step 5: Import Company Data

Upload employees and knowledge base for each company:
```javascript
// Admin dashboard or API
POST /api/admin/employees/upload
Headers: X-Widget-Domain: acme.com
Body: FormData with Excel file

POST /api/admin/knowledge/upload
Headers: X-Widget-Domain: acme.com
Body: { entries: [...] }
```

## API Changes

### Request Headers
All widget requests should include domain information:
- **Automatic**: Set by `companyContextMiddleware` from Origin/Referer
- **Manual**: Add `X-Widget-Domain: company.com` header

### Response Changes
Session creation now returns company info:
```json
{
  "success": true,
  "data": {
    "sessionId": "...",
    "conversationId": "...",
    "employee": {
      "id": "...",
      "name": "John Doe",
      "policyType": "Premium"
    },
    "company": {
      "name": "Acme Corporation"
    }
  }
}
```

## Redis Caching

Company lookups are cached in Redis:
- **Key**: `company:domain:{normalized_domain}`
- **TTL**: 300 seconds (5 minutes)
- **Automatic**: Handled by middleware
- **Invalidation**: Call `invalidateCompanyCache(domain)` when company updated

## Admin Routes (To Be Implemented)

### Company Management Endpoints

```javascript
// backend/api/routes/admin.js

// List all companies
GET /api/admin/companies

// Get company by ID
GET /api/admin/companies/:id

// Create new company
POST /api/admin/companies
Body: { name, domain, additionalDomains, settings }

// Update company
PATCH /api/admin/companies/:id
Body: { name, status, settings, etc. }

// Delete company (soft delete)
DELETE /api/admin/companies/:id

// Generate schema SQL
GET /api/admin/companies/:id/schema-sql

// Get company statistics
GET /api/admin/companies/:id/stats
```

## Widget Modifications (Pending)

### Changes Needed in `frontend/widget/src/embed.js`:

```javascript
// Detect parent domain
function getParentDomain() {
  try {
    // Try ancestorOrigins first (most reliable)
    if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
      return new URL(window.location.ancestorOrigins[0]).hostname;
    }

    // Fallback to referrer
    if (document.referrer) {
      return new URL(document.referrer).hostname;
    }

    // Last resort - current domain
    return window.location.hostname;
  } catch (error) {
    console.error('Error detecting parent domain:', error);
    return 'localhost'; // Default for testing
  }
}

// Include domain in API calls
async function createSession(employeeId) {
  const domain = getParentDomain();

  const response = await fetch(`${apiUrl}/api/chat/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Widget-Domain': domain  // Add custom header
    },
    body: JSON.stringify({
      employeeId,
      domain,  // Also in body for redundancy
      metadata: {
        widgetVersion: '1.0.0',
        embeddedAt: domain
      }
    })
  });

  return response.json();
}
```

## Admin Dashboard UI (Pending)

### Components Needed:

1. **Company List Page** (`frontend/admin/src/pages/Companies.jsx`)
   - List all companies with search/filter
   - Status indicators (active/inactive)
   - Domain information
   - Quick actions (view, edit, delete)

2. **Company Form** (`frontend/admin/src/components/CompanyForm.jsx`)
   - Company name, domains
   - Schema name (auto-generated)
   - Settings (JSON editor)
   - Status selector

3. **Company Detail Page** (`frontend/admin/src/pages/CompanyDetail.jsx`)
   - Company information
   - Statistics (employees, queries, escalations)
   - Schema SQL generator
   - Employee/KB management scoped to company

4. **Company Selector** (`frontend/admin/src/components/CompanySelector.jsx`)
   - Dropdown to switch between companies
   - Store selected company in state
   - Filter all data by selected company

## Testing Guide

### Test with Multiple Domains

1. **Update hosts file** (C:\Windows\System32\drivers\etc\hosts):
```
127.0.0.1 company-a.local
127.0.0.1 company-b.local
```

2. **Register test companies**:
```sql
INSERT INTO public.companies (name, domain, schema_name) VALUES
  ('Company A', 'company-a.local', 'company_a'),
  ('Company B', 'company-b.local', 'company_b');
```

3. **Create schemas** for both companies using template

4. **Import test data** for each company

5. **Test widget** on each domain:
   - Open http://company-a.local:PORT
   - Verify widget connects to company_a schema
   - Check separate data isolation

### Verification Checklist

- [ ] Company registry table created
- [ ] Default company exists
- [ ] Company schema template tested
- [ ] Multiple company schemas created
- [ ] Domain middleware extracts domain correctly
- [ ] Redis caching working
- [ ] Company-specific Supabase clients created
- [ ] Chat routes use correct schema
- [ ] Data isolation verified (no cross-company access)
- [ ] Widget sends domain information
- [ ] Admin routes implemented
- [ ] Admin UI for company management
- [ ] End-to-end test with 2+ companies

## Troubleshooting

### Common Issues:

1. **"Company not found for this domain"**
   - Check company registered in `public.companies`
   - Verify domain matches exactly (case-insensitive)
   - Check Redis cache (`redis-cli GET company:domain:xxx`)
   - Ensure company status is 'active'

2. **"Schema does not exist"**
   - Schema not created in PostgreSQL
   - Run company-schema-template.sql with correct schema name
   - Check PostgreSQL: `SELECT nspname FROM pg_namespace;`

3. **Cross-tenant data leakage**
   - Verify middleware is applied to all routes
   - Check `req.supabase` is company-specific client
   - Test with different domains/schemas

4. **Widget not sending domain**
   - Check browser console for domain detection
   - Verify X-Widget-Domain header in network tab
   - Check CORS allows custom headers

## Security Considerations

1. **Row Level Security**: Not needed at table level (schema isolation is stronger)
2. **Schema Access**: Each company-specific client only accesses its schema
3. **Domain Verification**: Middleware validates domain ownership
4. **API Keys**: Consider company-specific API keys for additional security
5. **Rate Limiting**: Already implemented per employee, consider per-company limits

## Performance Optimization

1. **Connection Pooling**: Schema clients cached to avoid reconnection overhead
2. **Redis Caching**: Company lookups cached for 5 minutes
3. **Index Optimization**: Each schema has proper indexes for vectors and queries
4. **Query Optimization**: RPC functions optimized for similarity search

## Migration from Single-Tenant

If you have existing data:

1. **Backup existing data**
2. **Create default company** for existing data
3. **Create company_default schema**
4. **Migrate existing data** to company_default schema:
```sql
-- Example migration
INSERT INTO company_default.employees
SELECT * FROM public.employees;

INSERT INTO company_default.knowledge_base
SELECT * FROM public.knowledge_base;
```

## Next Steps

1. ✅ Company registry created
2. ✅ Schema template created
3. ✅ Domain middleware implemented
4. ✅ Chat routes updated for multi-tenancy
5. ⏳ Update admin routes with company management
6. ⏳ Modify widget to send domain
7. ⏳ Build admin UI for company management
8. ⏳ Test with multiple companies
9. ⏳ Deploy and monitor

## Support

For questions or issues:
- Check this documentation first
- Review code comments in key files
- Test with localhost default company first
- Verify SQL scripts executed correctly

---

**Implementation Date**: 2025-10-17
**Status**: Backend infrastructure complete, frontend updates pending
**Next Phase**: Admin routes + Widget modification + Admin UI
