# CC Support for LOG Request Emails
**Date:** 2025-11-11
**Enhancement:** Added CC (Carbon Copy) recipient support to LOG request emails

## Overview

Extended the LOG request email system to support CC (Carbon Copy) recipients in addition to primary "To" recipients. This allows companies to include additional stakeholders (managers, supervisors, etc.) who need visibility into LOG requests without being the primary handlers.

---

## What Changed

### Database Schema
**File:** `backend/migrations/add_company_email_config.sql`

Added new column to `public.companies` table:

```sql
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS log_request_email_cc VARCHAR(500);
```

**Field:**
- `log_request_email_cc`: Comma-separated list of CC recipients (optional)

### Backend Changes

#### 1. Email Service
**File:** `backend/api/services/email.js`

**Updated Function:** `sendLogRequestEmail()`

```javascript
// New parameter in companyConfig
const emailCc = companyConfig.log_request_email_cc || null;

// Add CC recipients to message
if (emailCc && emailCc.trim()) {
  message.ccRecipients = emailCc.split(',').map(email => ({
    emailAddress: {
      address: email.trim()
    }
  }));
}
```

**Features:**
- Accepts `log_request_email_cc` in `companyConfig`
- Validates and parses comma-separated CC emails
- Adds `ccRecipients` to Microsoft Graph API message
- Updates log messages to show CC recipients

#### 2. Admin API
**File:** `backend/api/routes/admin.js`

**Endpoint:** `PATCH /api/admin/companies/:id/email-config`

```javascript
// Request body now accepts CC field
const { log_request_email_to, log_request_email_cc, log_request_keywords } = req.body;

// Validation for CC emails
if (log_request_email_cc !== undefined && log_request_email_cc !== null && log_request_email_cc.trim() !== '') {
  const emails = log_request_email_cc.split(',').map(e => e.trim());

  for (const email of emails) {
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: `Invalid CC email format: ${email}`
      });
    }
  }
}
```

**Features:**
- Accepts `log_request_email_cc` in request body
- Validates CC email format
- Saves to database
- Returns updated company data with CC field

#### 3. Chat Route
**File:** `backend/api/routes/chat.js`

**Updated:** LOG request handler to pass CC configuration

```javascript
const companyConfig = {
  log_request_email_to: req.company?.log_request_email_to || null,
  log_request_email_cc: req.company?.log_request_email_cc || null  // ← Added
};
```

### Frontend Changes

#### Email Configuration Modal
**File:** `frontend/admin/src/components/EmailConfigModal.jsx`

**Added UI Elements:**

1. **CC Input Field:**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    CC Recipients (Optional)
  </label>
  <input
    type="text"
    value={emailConfig.log_request_email_cc}
    onChange={(e) => setEmailConfig({ ...emailConfig, log_request_email_cc: e.target.value })}
    placeholder="manager@company.com, supervisor@company.com"
  />
  <p className="text-xs text-gray-500 mt-1">
    CC recipients - comma-separated email addresses (optional)
  </p>
</div>
```

2. **Updated Help Text:**
- Explains difference between To and CC
- To: Primary support team members who handle the request
- CC: Optional additional recipients (managers, supervisors, etc.)

3. **Enhanced Preview:**
- Shows both To and CC recipients
- Only displays CC if configured

---

## Email Flow

### With CC Recipients

```
User triggers LOG request
      ↓
Backend processes request
      ↓
Email service receives:
  • To: support@company.com, team@company.com
  • CC: manager@company.com, supervisor@company.com
      ↓
Microsoft Graph API sends email:
  • To recipients receive in inbox (primary)
  • CC recipients receive in inbox (for visibility)
      ↓
Both groups can see the full conversation history
```

### Without CC Recipients

```
User triggers LOG request
      ↓
Backend processes request
      ↓
Email service receives:
  • To: support@company.com, team@company.com
  • CC: null (not configured)
      ↓
Microsoft Graph API sends email:
  • Only To recipients receive email
  • No CC field in email
```

---

## Usage Examples

### Example 1: Support Team + Manager
```
To: support@company.com, helpdesk@company.com
CC: manager@company.com
```
- Support team handles the request
- Manager gets visibility for oversight

### Example 2: Multi-Department Support
```
To: hr-support@company.com
CC: hr-manager@company.com, compliance@company.com
```
- HR support handles the request
- Manager and compliance get copies for tracking

### Example 3: No CC (Simple Setup)
```
To: support@company.com
CC: (empty)
```
- Only support team receives emails
- No additional visibility needed

---

## API Reference

### Update Email Configuration

**Endpoint:** `PATCH /api/admin/companies/:id/email-config`

**Request Body:**
```json
{
  "log_request_email_to": "support@company.com, team@company.com",
  "log_request_email_cc": "manager@company.com, supervisor@company.com",
  "log_request_keywords": ["request log", "send logs", "need log"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Company A",
    "log_request_email_to": "support@company.com, team@company.com",
    "log_request_email_cc": "manager@company.com, supervisor@company.com",
    "log_request_keywords": ["request log", "send logs", "need log"],
    ...
  }
}
```

**Validation:**
- Email format validation for both To and CC fields
- Comma-separated emails supported
- CC field is optional (can be null or empty)

---

## Admin UI Workflow

### Configuring CC Recipients

1. **Navigate** to Companies page in admin panel
2. **Click** 📧 button next to company
3. **Fill in fields:**
   - **To:** support@company.com (required)
   - **CC:** manager@company.com (optional)
   - **Keywords:** request log, send logs (optional)
4. **Preview** configuration shows both To and CC
5. **Save** configuration

### Preview Display

```
📧 Configuration Preview:
To: support@company.com, team@company.com
CC: manager@company.com, supervisor@company.com
Keywords: request log, send logs, need log
```

---

## Differences: To vs CC

| Aspect | To Recipients | CC Recipients |
|--------|--------------|---------------|
| **Purpose** | Primary handlers | Additional visibility |
| **Required** | Yes | No (optional) |
| **Typical Use** | Support team | Managers, supervisors |
| **Reply Expectation** | Expected to respond | FYI only |
| **Email Visibility** | All recipients see each other | All recipients see each other |

**Note:** In email, both To and CC recipients receive the same email content. The difference is organizational - "To" implies action required, "CC" implies awareness only.

---

## Migration Guide

### For Existing Installations

1. **Run Database Migration:**
   ```sql
   -- In Supabase SQL editor
   -- Execute: backend/migrations/add_company_email_config.sql
   ```

2. **Verify Column Added:**
   ```sql
   SELECT id, name, log_request_email_to, log_request_email_cc
   FROM public.companies;
   ```

3. **Configure Companies (Optional):**
   - Login to admin panel
   - Click 📧 for each company
   - Add CC recipients if needed
   - Save configuration

4. **Test:**
   - Trigger LOG request from widget
   - Verify email sent to both To and CC recipients

### Backward Compatibility

✅ **Fully backward compatible:**
- Existing companies without CC configuration work unchanged
- CC field is optional - can be null or empty
- If CC is not configured, only To recipients receive email
- No changes needed to existing configurations

---

## Technical Implementation

### Microsoft Graph API Integration

```javascript
// Email message structure
const message = {
  subject: "🚨 LOG Request - Employee Name",
  body: {
    contentType: 'HTML',
    content: htmlBody
  },
  toRecipients: [
    { emailAddress: { address: "support@company.com" } },
    { emailAddress: { address: "team@company.com" } }
  ],
  ccRecipients: [  // ← Optional field
    { emailAddress: { address: "manager@company.com" } },
    { emailAddress: { address: "supervisor@company.com" } }
  ],
  attachments: [...]
};
```

**Graph API Endpoint:**
```
POST /users/{emailFrom}/sendMail
```

**Permission Required:**
- `Mail.Send` (delegated permission)

---

## Logging

### Console Output Examples

**With CC:**
```
✓ LOG request email sent successfully to support@company.com, team@company.com (CC: manager@company.com)
```

**Without CC:**
```
✓ LOG request email sent successfully to support@company.com, team@company.com
```

---

## Best Practices

### When to Use CC

✅ **Good Use Cases:**
- Manager oversight of support team
- Compliance team awareness
- Cross-department visibility
- Escalation tracking
- Audit trail requirements

❌ **Avoid Using CC For:**
- Primary support team members (use To instead)
- External stakeholders (privacy concerns)
- Large distribution lists (email overload)
- Action-required recipients (use To instead)

### Email Volume Considerations

**Recommended:**
- To: 1-3 primary support members
- CC: 1-2 oversight/management roles
- Total: Keep under 5-7 recipients

**Why?**
- Reduces email noise
- Clearer responsibility
- Better response times
- Easier tracking

---

## Testing Checklist

- [ ] Database migration applied successfully
- [ ] Company table has `log_request_email_cc` column
- [ ] Admin UI shows CC input field
- [ ] Can save CC configuration via admin panel
- [ ] Email validation works for CC field
- [ ] LOG request sends to both To and CC recipients
- [ ] Preview shows CC recipients when configured
- [ ] Works without CC (backward compatible)
- [ ] Multiple comma-separated CC emails work
- [ ] Invalid CC email format shows error
- [ ] Console log shows CC recipients

---

## Files Modified

### Backend
- `backend/migrations/add_company_email_config.sql` - Added CC column
- `backend/api/services/email.js` - Added CC recipient handling
- `backend/api/routes/admin.js` - Added CC validation and update
- `backend/api/routes/chat.js` - Pass CC config to email service

### Frontend
- `frontend/admin/src/components/EmailConfigModal.jsx` - Added CC input and preview

---

## Summary

### What You Can Do Now

✅ Configure primary "To" recipients (support team)
✅ Configure optional "CC" recipients (managers, supervisors)
✅ Validate email formats for both To and CC
✅ Preview configuration before saving
✅ Automatic email sending to all configured recipients

### Benefits

- **Visibility:** Managers can track support requests without being primary handlers
- **Compliance:** Create audit trails for sensitive requests
- **Oversight:** Supervisors get awareness without handling responsibility
- **Flexibility:** Optional - use only when needed
- **Scalability:** Support multiple stakeholders per company
