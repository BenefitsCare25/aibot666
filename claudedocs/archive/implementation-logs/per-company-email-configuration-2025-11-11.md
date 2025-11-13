# Per-Company Email Configuration for LOG Requests
**Date:** 2025-11-11
**Feature:** Company-specific support team email addresses for LOG requests

## Problem Statement

The original LOG request email system used a single environment variable (`LOG_REQUEST_EMAIL_TO`) for all companies, which doesn't work in a multi-tenant environment where each company needs different support team emails.

## Solution Overview

Implemented a per-company email configuration system that allows each company to have its own support team email addresses and LOG request keywords, manageable through the admin frontend.

---

## Implementation Details

### 1. Database Schema Changes

**File:** `backend/migrations/add_company_email_config.sql`

Added two new columns to `public.companies` table:

```sql
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS log_request_email_to VARCHAR(500),
ADD COLUMN IF NOT EXISTS log_request_keywords TEXT[] DEFAULT ARRAY['request log', 'send logs', 'need log'];
```

**Fields:**
- `log_request_email_to`: Comma-separated list of support team emails
- `log_request_keywords`: Array of keywords that trigger LOG request mode

---

### 2. Backend API Changes

#### Email Service Update
**File:** `backend/api/services/email.js`

Modified `sendLogRequestEmail()` function to accept company-specific configuration:

```javascript
// New parameter added
companyConfig = {}

// Use company-specific email or fallback to environment variable
const emailTo = companyConfig.log_request_email_to || LOG_REQUEST_EMAIL_TO;
```

**Behavior:**
1. First checks if company has configured email (`companyConfig.log_request_email_to`)
2. Falls back to environment variable (`LOG_REQUEST_EMAIL_TO`) if not configured
3. Throws error if neither is available

#### New Admin Endpoint
**File:** `backend/api/routes/admin.js`

Added new PATCH endpoint for updating email configuration:

```
PATCH /api/admin/companies/:id/email-config
```

**Request Body:**
```json
{
  "log_request_email_to": "support@company.com, team@company.com",
  "log_request_keywords": ["request log", "send logs", "need log"]
}
```

**Features:**
- Email format validation (regex check)
- Support for comma-separated multiple emails
- Cache invalidation after update
- Error handling with detailed messages

#### Chat Route Update
**File:** `backend/api/routes/chat.js` (line 371-385)

Updated LOG request handler to pass company configuration:

```javascript
// Get company configuration from middleware
const companyConfig = {
  log_request_email_to: req.company?.log_request_email_to || null
};

// Pass to email service
const emailResult = await sendLogRequestEmail({
  employee,
  conversationHistory,
  conversationId: session.conversationId,
  requestType: 'button',
  requestMessage: message || 'User requested LOG via button',
  attachments,
  companyConfig  // ← New parameter
});
```

**Note:** `req.company` is populated by `companyContextMiddleware` which loads company data based on domain

---

### 3. Frontend Admin UI

#### API Client Update
**File:** `frontend/admin/src/api/companies.js`

Added new API method:

```javascript
updateEmailConfig: async (id, emailConfig) => {
  return apiClient.patch(`/api/admin/companies/${id}/email-config`, emailConfig);
}
```

#### Email Configuration Modal
**File:** `frontend/admin/src/components/EmailConfigModal.jsx` (NEW)

Created dedicated modal component for email configuration with:

**Features:**
- Support team email input with validation
- LOG request keywords management
- Real-time configuration preview
- Help section explaining how LOG requests work
- Loading states and error handling

**UI Elements:**
1. **Support Team Email(s)** - Text input accepting comma-separated emails
2. **LOG Request Keywords** - Text input for comma-separated keywords
3. **Info Section** - Explains LOG request workflow
4. **Preview Section** - Shows current configuration

#### Companies Page Update
**File:** `frontend/admin/src/pages/Companies.jsx`

Added email configuration button to action column:

```jsx
<button
  onClick={() => setShowEmailConfig(company)}
  className="text-purple-600 hover:text-purple-900 mr-3"
  title="Configure email settings"
>
  📧
</button>
```

**Integration:**
- Import EmailConfigModal component
- Add state for `showEmailConfig`
- Render modal when company selected
- Refresh company list on successful update
- Show success message after configuration saved

---

## User Workflow

### Admin Setup

1. **Navigate to Companies page** in admin panel
2. **Click 📧 button** next to any company
3. **Configure email settings:**
   - Enter support team email(s) (comma-separated)
   - Optionally customize LOG request keywords
4. **Save configuration**
5. System validates emails and saves to database

### Employee Usage (No Changes)

The LOG request process remains the same for employees:
1. Click "Request LOG" button or type keyword
2. Upload attachments (optional)
3. Provide email for acknowledgment (optional)
4. Submit request

**Behind the scenes:**
- System now uses company-specific support email
- Falls back to environment variable if not configured

---

## Email Flow Architecture

```
User triggers LOG request
      ↓
Backend retrieves session → identifies company
      ↓
Middleware loads company data (including email config)
      ↓
Email service receives companyConfig parameter
      ↓
Priority check:
  1. companyConfig.log_request_email_to
  2. process.env.LOG_REQUEST_EMAIL_TO
  3. Error if neither exists
      ↓
Email sent via Microsoft Graph API
      ↓
Two emails sent:
  • Support team (company-specific)
  • User acknowledgment (optional)
```

---

## Configuration Hierarchy

### Email Recipients (Priority Order)

1. **Company-specific** - `companies.log_request_email_to` (database)
2. **Global fallback** - `LOG_REQUEST_EMAIL_TO` (environment variable)
3. **Error** - If neither configured

### Email Sender

- Always uses `LOG_REQUEST_EMAIL_FROM` (environment variable)
- Service account for Microsoft Graph API

### Keywords

- Company-specific keywords from `companies.log_request_keywords`
- Default: `['request log', 'send logs', 'need log']`

---

## Database Migration Steps

To apply this feature to existing system:

1. **Run migration:**
   ```bash
   # Connect to Supabase SQL editor
   # Execute: backend/migrations/add_company_email_config.sql
   ```

2. **Verify columns added:**
   ```sql
   SELECT id, name, schema_name, log_request_email_to, log_request_keywords
   FROM public.companies;
   ```

3. **Configure companies via Admin UI:**
   - Login to admin panel
   - Navigate to Companies
   - Click 📧 for each company
   - Set support team emails

---

## Benefits

✅ **Multi-tenant Support** - Each company has separate support email
✅ **Flexible Configuration** - Multiple emails per company
✅ **Easy Management** - Update via admin UI, no code changes
✅ **Backward Compatible** - Falls back to environment variable
✅ **Validation** - Email format validation prevents errors
✅ **Cache Management** - Automatic cache invalidation on updates
✅ **User-Friendly** - Clear UI with help text and previews

---

## Testing Checklist

- [ ] Run database migration
- [ ] Configure email for at least one company via Admin UI
- [ ] Test LOG request from that company's widget
- [ ] Verify email sent to company-specific address
- [ ] Test with company that has NO email configured (should use env variable)
- [ ] Test with multiple comma-separated emails
- [ ] Test email validation with invalid format
- [ ] Verify cache invalidation (change email, test immediately)

---

## Files Modified

### Backend
- `backend/migrations/add_company_email_config.sql` - NEW
- `backend/api/services/email.js` - MODIFIED (companyConfig parameter)
- `backend/api/routes/admin.js` - MODIFIED (new email-config endpoint)
- `backend/api/routes/chat.js` - MODIFIED (pass companyConfig)

### Frontend
- `frontend/admin/src/components/EmailConfigModal.jsx` - NEW
- `frontend/admin/src/api/companies.js` - MODIFIED (new API method)
- `frontend/admin/src/pages/Companies.jsx` - MODIFIED (email config button + modal)

---

## Future Enhancements

1. **Email Templates** - Per-company email templates
2. **CC/BCC Support** - Additional recipients
3. **Email History** - Track sent LOG request emails
4. **Test Email** - Send test email from admin UI
5. **Email Statistics** - Track email delivery success/failure rates

---

## Environment Variables Reference

```env
# Azure AD for Email
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_SERVICE_ACCOUNT_USERNAME=notifications@yourcompany.com
AZURE_SERVICE_ACCOUNT_PASSWORD=your-service-account-password

# Email Configuration
LOG_REQUEST_EMAIL_FROM=notifications@yourcompany.com
LOG_REQUEST_EMAIL_TO=default-support@yourcompany.com  # Global fallback
```

**Note:** `LOG_REQUEST_EMAIL_TO` now serves as a fallback when company-specific email is not configured.
