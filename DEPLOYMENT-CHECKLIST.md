# LOG Request Email Workflow - Deployment Checklist

Use this checklist to ensure all components are properly configured and tested before going live.

---

## ✅ Pre-Deployment Checklist

### 1. Azure AD Configuration
- [ ] Navigate to Azure Portal → App Registrations → Your App
- [ ] Go to "API permissions"
- [ ] Add Application Permission: `Mail.Send`
- [ ] Click "Grant admin consent for [Organization]"
- [ ] Verify permission shows "Granted" status ✅
- [ ] Note down the Client Secret (you'll need it)

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 2. Environment Variables
- [ ] Open `backend/.env` file
- [ ] Add/Update the following variables:

```bash
# Azure AD Configuration
AZURE_CLIENT_ID=d5042b07-f7dc-4706-bf6f-847a7bd1538d
AZURE_CLIENT_SECRET=<paste-your-secret-here>
AZURE_TENANT_ID=496f1a0a-6a4a-4436-b4b3-fdb75d235254

# Email Configuration
LOG_REQUEST_EMAIL_FROM=notifications@yourcompany.com
LOG_REQUEST_EMAIL_TO=support-team@yourcompany.com
LOG_REQUEST_KEYWORDS=request log,send logs,need log

# File Upload Configuration (optional - defaults shown)
MAX_ATTACHMENT_SIZE=10485760
MAX_ATTACHMENTS=5
UPLOAD_DIR=./uploads
```

- [ ] Verify email addresses are correct
- [ ] Verify Client Secret is correct
- [ ] Save file

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 3. Database Migration
- [ ] Open Supabase SQL Editor
- [ ] Select your company schema (or run for all schemas)
- [ ] Open `backend/migrations/add_log_requests_table.sql`
- [ ] Copy SQL contents
- [ ] Paste into Supabase SQL Editor
- [ ] Click "Run" to execute
- [ ] Verify table `log_requests` was created
- [ ] Check indexes were created (3 indexes)
- [ ] Verify RLS policy was added

**For multiple company schemas**:
- [ ] Repeat for each schema: `company_a`, `company_b`, etc.
- [ ] Document which schemas have been migrated

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 4. Backend Testing

#### 4.1 Install Dependencies
```bash
cd backend
npm install
```
- [ ] All packages installed successfully
- [ ] No critical vulnerabilities

#### 4.2 Test Email Service
```bash
node test-email.js
```
**Expected Output**:
```
Testing Email Service...
📧 Test 1: Sending LOG Request Email to Support Team
✓ LOG request email sent successfully!
📧 Test 2: Sending Acknowledgment Email to User
✓ Acknowledgment email sent successfully!
✓ All tests completed successfully!
```

**Checklist**:
- [ ] Test script ran without errors
- [ ] Support team email received
- [ ] Acknowledgment email received
- [ ] Emails are properly formatted (HTML)
- [ ] Attachments section displays correctly

**If tests fail**:
- [ ] Check Azure credentials in .env
- [ ] Verify Mail.Send permission granted
- [ ] Check email addresses are valid
- [ ] Review error logs for details

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 5. Frontend Build

#### 5.1 Build Widget
```bash
cd frontend/widget
npm run build
```
- [ ] Build completed successfully
- [ ] No TypeScript/JavaScript errors
- [ ] Output files generated in `dist/`
  - [ ] `dist/widget.iife.js` exists
  - [ ] `dist/widget.css` exists

#### 5.2 Verify Components
- [ ] FileAttachment.jsx compiles
- [ ] EmailInput.jsx compiles
- [ ] MessageInput.jsx compiles (enhanced)
- [ ] ChatWindow.jsx compiles (integrated)
- [ ] chatStore.js compiles (with new actions)

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 6. Upload Directories
```bash
cd backend
mkdir -p uploads/temp uploads/logs
```
- [ ] `uploads/` directory exists
- [ ] `uploads/temp/` directory exists
- [ ] `uploads/logs/` directory exists
- [ ] Proper permissions set (755 for directories)
- [ ] `.gitkeep` files in place

**For production servers**:
- [ ] Set up cron job to clean temp files (>1 hour old)
- [ ] Set up cron job to clean old LOG files (>30 days)

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 7. Backend Deployment

#### 7.1 Start Backend Server
```bash
cd backend
npm run dev  # or npm start for production
```
- [ ] Server starts without errors
- [ ] Port 3000 is accessible
- [ ] No configuration errors in logs

#### 7.2 Test Endpoints
```bash
# Test file upload endpoint
curl -X POST http://localhost:3000/api/chat/upload-attachment \
  -H "X-Widget-Domain: localhost" \
  -F "file=@test-file.pdf" \
  -F "sessionId=test-session"

# Expected: {"success": true, "data": {...}}
```

- [ ] Upload endpoint responds
- [ ] File is saved to `uploads/temp/`
- [ ] Response includes file metadata

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 8. Frontend Testing (Manual)

#### 8.1 Widget Integration
- [ ] Widget loads on test page
- [ ] Login with test employee ID works
- [ ] Chat interface displays correctly

#### 8.2 File Attachment
- [ ] Paperclip icon visible in message input
- [ ] Click paperclip → file picker opens
- [ ] Select PDF file → preview card appears
- [ ] File icon displays correctly (📄 for PDF)
- [ ] File size displays correctly
- [ ] Can remove file (X button works)
- [ ] Can attach multiple files (up to 5)
- [ ] File size limit enforced (10MB)
- [ ] File type validation works (only allowed types)
- [ ] Attachment counter badge shows on LOG button

#### 8.3 Email Input
- [ ] Click "Request LOG" → email input appears
- [ ] Email input has blue background
- [ ] Email icon displays correctly
- [ ] Label: "Your Email (Optional)" shows
- [ ] Placeholder: "email@example.com" shows
- [ ] Helper text displays below input
- [ ] Type invalid email → red border appears
- [ ] Type valid email → normal border
- [ ] Error message displays for invalid email
- [ ] Can skip email (leave blank and proceed)

#### 8.4 LOG Request Flow
- [ ] Attach 1-2 test files
- [ ] Click "Request LOG" button
- [ ] Email input appears
- [ ] Enter test email address
- [ ] Click "Request LOG" again
- [ ] Loading indicator shows briefly
- [ ] Success message appears in chat
- [ ] Message includes email confirmation
- [ ] LOG button changes to "✅ Sent" (green)
- [ ] LOG button is disabled
- [ ] Attachments cleared from UI

#### 8.5 Email Verification
- [ ] Check support team email inbox
  - [ ] Email received with subject "🚨 LOG Request"
  - [ ] Employee details displayed
  - [ ] Conversation history formatted correctly
  - [ ] Attachments included
  - [ ] HTML formatting looks professional
- [ ] Check user email inbox (test email provided)
  - [ ] Email received with subject "✅ LOG Request Received"
  - [ ] Reference ID displayed
  - [ ] Request summary correct
  - [ ] Next steps clearly listed
  - [ ] HTML formatting looks professional

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 9. Database Verification
```sql
-- Check log_requests table
SELECT * FROM log_requests ORDER BY created_at DESC LIMIT 5;

-- Verify data
SELECT
  conversation_id,
  employee_id,
  request_type,
  user_email,
  acknowledgment_sent,
  email_sent,
  created_at
FROM log_requests;
```

- [ ] Table exists and accessible
- [ ] Test LOG request recorded
- [ ] `email_sent` = true
- [ ] `acknowledgment_sent` = true (if email provided)
- [ ] `attachments` JSONB contains file data
- [ ] `user_email` stored correctly
- [ ] Timestamps recorded

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 10. Multi-Tenant Testing

For each company schema:
- [ ] Schema 1: ____________
  - [ ] Migration run successfully
  - [ ] Test LOG request sent
  - [ ] Email received with correct employee data
  - [ ] Attachments work correctly
- [ ] Schema 2: ____________
  - [ ] Migration run successfully
  - [ ] Test LOG request sent
  - [ ] Email received with correct employee data
  - [ ] Attachments work correctly

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 11. Production Deployment

#### 11.1 Backend Production
- [ ] Update production `.env` with correct values
- [ ] Build production: `npm run build` (if applicable)
- [ ] Start production server: `npm start`
- [ ] Verify server accessible at production URL
- [ ] Test upload endpoint in production
- [ ] Test LOG request endpoint in production
- [ ] Monitor logs for errors

#### 11.2 Frontend Production
- [ ] Build production widget: `npm run build`
- [ ] Deploy `dist/widget.iife.js` to CDN/server
- [ ] Deploy `dist/widget.css` to CDN/server
- [ ] Update widget embed code on client websites
- [ ] Verify widget loads correctly
- [ ] Test full LOG request flow in production

#### 11.3 Infrastructure
- [ ] Upload directories created on production server
- [ ] Cron jobs configured:
  - [ ] Clean temp files: `0 * * * * find /path/uploads/temp -mmin +60 -delete`
  - [ ] Clean old LOGs: `0 0 * * * find /path/uploads/logs -mtime +30 -delete`
- [ ] Nginx/Apache configured:
  - [ ] `client_max_body_size 10M` (Nginx)
  - [ ] `LimitRequestBody 10485760` (Apache)
- [ ] Firewall allows outbound HTTPS to graph.microsoft.com
- [ ] SSL certificates valid

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 12. Monitoring Setup

#### 12.1 Logs
- [ ] Configure log rotation for `backend/logs/`
- [ ] Set up log monitoring/alerting
- [ ] Monitor error.log for failed emails
- [ ] Monitor combined.log for LOG requests

#### 12.2 Metrics
- [ ] Email send success rate tracked
- [ ] File upload success rate tracked
- [ ] Average email delivery time tracked
- [ ] Storage usage monitored
- [ ] LOG request frequency tracked per company

#### 12.3 Alerts
- [ ] Alert on email send failures (>5% failure rate)
- [ ] Alert on storage usage (>80% capacity)
- [ ] Alert on file upload failures (>10% failure rate)

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 13. Documentation

- [ ] README-LOG-REQUEST.md reviewed
- [ ] IMPLEMENTATION-SUMMARY.md reviewed
- [ ] Team trained on new feature
- [ ] Support team knows how to handle LOG request emails
- [ ] Users informed about new feature (if applicable)

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

### 14. Final Verification

- [ ] End-to-end test completed successfully
- [ ] All automated tests passing
- [ ] Manual testing completed without issues
- [ ] Production deployment successful
- [ ] Monitoring in place
- [ ] Support team ready
- [ ] Rollback plan documented

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

## 🚨 Rollback Plan

If critical issues are discovered:

### Immediate Actions
1. **Disable Feature**:
   - Comment out LOG button in MessageInput.jsx
   - Rebuild frontend: `npm run build`
   - Redeploy widget

2. **Backend Rollback**:
   - Revert chat.js to previous version
   - Remove email.js service
   - Restart backend server

3. **Database**:
   - Keep log_requests table (data preserved)
   - Can be removed later if needed

### Contact Information
- **Technical Issues**: [Your Email/Slack]
- **Azure Support**: [Azure Support Contact]
- **Production Issues**: [On-Call Engineer]

---

## ✅ Sign-Off

Once all checklist items are complete, obtain sign-off from:

- [ ] **Developer**: _________________ Date: _______
- [ ] **QA/Tester**: _________________ Date: _______
- [ ] **DevOps**: ___________________ Date: _______
- [ ] **Product Owner**: _____________ Date: _______

---

## 📊 Post-Deployment Metrics (First 7 Days)

Track these metrics for the first week:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| LOG requests sent | - | - | - |
| Email send success rate | >99% | - | - |
| File upload success rate | >99% | - | - |
| Acknowledgment sent rate | >95% | - | - |
| Average email delivery time | <5s | - | - |
| User complaints | <5 | - | - |
| Support team feedback | Positive | - | - |

---

**Deployment Date**: ____________
**Deployed By**: ________________
**Version**: 1.0.0
**Status**: ⬜ Not Started | ⬜ In Progress | ✅ Complete

---

Good luck with your deployment! 🚀
