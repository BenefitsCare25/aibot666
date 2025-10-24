# LOG Request Email Workflow - Implementation Guide

This document provides a quick reference for the LOG request email workflow that has been implemented in your chatbot system.

## Overview

The LOG request feature allows chatbot users to:
- **Request comprehensive logs** of their conversation with support team
- **Attach files** (up to 5 files, 10MB each) - PDF, DOC, XLS, images
- **Provide email** (optional) to receive acknowledgment confirmation
- **Receive automatic acknowledgment** emails when LOG is received

## Features Implemented

### Backend Features
✅ Microsoft Graph API email service integration
✅ File upload endpoint with validation (10MB, 5 files max)
✅ LOG request endpoint with conversation history
✅ Automatic email sending to support team
✅ Automatic acknowledgment emails to users
✅ Database tracking of LOG requests
✅ Multi-tenant support via company context

### Frontend Features
✅ File attachment component with drag-and-drop
✅ Email input component with validation
✅ Request LOG button with attachment counter
✅ Email input field (optional, shows on demand)
✅ Success messages with confirmation
✅ Visual feedback for file uploads

## Quick Start

### 1. Setup Azure AD App (Already Configured)

Your Azure credentials are already set up:
- **Client ID**: `d5042b07-f7dc-4706-bf6f-847a7bd1538d`
- **Tenant ID**: `496f1a0a-6a4a-4436-b4b3-fdb75d235254`

**Required API Permission**:
- Go to Azure Portal → App Registrations → Your App
- Navigate to "API permissions"
- Add: `Mail.Send` (Application permission)
- Click "Grant admin consent" ✅

### 2. Configure Environment Variables

Add these to your `backend/.env` file:

```bash
# Azure AD Configuration
AZURE_CLIENT_ID=d5042b07-f7dc-4706-bf6f-847a7bd1538d
AZURE_CLIENT_SECRET=your-secret-here
AZURE_TENANT_ID=496f1a0a-6a4a-4436-b4b3-fdb75d235254

# Email Configuration
LOG_REQUEST_EMAIL_FROM=notifications@yourcompany.com
LOG_REQUEST_EMAIL_TO=support-team@yourcompany.com
LOG_REQUEST_KEYWORDS=request log,send logs,need log
```

### 3. Run Database Migration

Execute the SQL migration in your Supabase SQL editor for each company schema:

```bash
# File: backend/migrations/add_log_requests_table.sql
```

Copy the contents and run in Supabase SQL editor.

### 4. Test Email Functionality

```bash
cd backend
node test-email.js
```

This will send test emails to verify the configuration is working correctly.

### 5. Build and Deploy Frontend

```bash
cd frontend/widget
npm run build
```

The widget will now include the new LOG request features.

## User Flow

### Requesting LOG with Email

1. **User attaches files** (optional)
   - Click paperclip icon
   - Select up to 5 files (10MB each)
   - Supported: PDF, DOC, XLS, images

2. **User clicks "Request LOG"**
   - Email input field appears
   - User can enter email (optional)

3. **User submits request**
   - Support team receives email with:
     - Full conversation history
     - Employee details
     - Attached files
   - User receives acknowledgment email with:
     - Reference ID
     - Request summary
     - Expected response time

4. **Success confirmation**
   - "✅ Your LOG request has been sent..."
   - If email provided: "A confirmation email has been sent to [email]"
   - LOG button changes to "✅ Sent" (green, disabled)

## File Structure

### Backend Files Created/Modified
```
backend/
├── api/
│   ├── services/
│   │   └── email.js                    [NEW] Email service
│   └── routes/
│       └── chat.js                     [MODIFIED] Added upload & LOG routes
├── migrations/
│   └── add_log_requests_table.sql      [NEW] Database migration
├── uploads/                            [NEW] Upload directories
│   ├── temp/                           Temporary uploads
│   └── logs/                           Permanent LOG files
├── test-email.js                       [NEW] Email testing script
└── .env.example                        [MODIFIED] Added email config

```

### Frontend Files Created/Modified
```
frontend/widget/src/
├── components/
│   ├── FileAttachment.jsx              [NEW] File upload UI
│   ├── EmailInput.jsx                  [NEW] Email input UI
│   ├── MessageInput.jsx                [MODIFIED] Added LOG button
│   └── ChatWindow.jsx                  [MODIFIED] Integrated features
└── store/
    └── chatStore.js                    [MODIFIED] Added LOG request logic
```

## API Endpoints

### POST /api/chat/upload-attachment
Upload a file for LOG request

**Request:**
- `Content-Type: multipart/form-data`
- `file`: File data
- `sessionId`: Session identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-filename.pdf",
    "name": "filename.pdf",
    "size": 12345,
    "mimetype": "application/pdf"
  }
}
```

### POST /api/chat/request-log
Request LOG with conversation history

**Request:**
```json
{
  "sessionId": "session-id",
  "message": "User message",
  "attachmentIds": ["uuid-file1.pdf"],
  "userEmail": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "logRequestId": "uuid",
    "emailSent": true,
    "attachmentCount": 1,
    "acknowledgmentSent": true
  }
}
```

## Email Templates

### Support Team Email
- **Subject**: 🚨 LOG Request - [Employee Name] - [Policy Type]
- **Contains**:
  - Employee information
  - Request details
  - Attachments list
  - Full conversation history (formatted HTML)

### User Acknowledgment Email
- **Subject**: ✅ LOG Request Received - Reference: [ID]
- **Contains**:
  - Reference ID for tracking
  - Request summary
  - Next steps
  - Expected response time (1-2 business days)

## Troubleshooting

### Email Not Sending

**Error: 401 Unauthorized**
- Verify Azure credentials in `.env`
- Check API permissions include `Mail.Send`
- Ensure admin consent granted

**Error: 403 Forbidden**
- Verify `LOG_REQUEST_EMAIL_FROM` mailbox exists
- Use shared mailbox or service account
- Grant app permission to send from mailbox

### File Upload Issues

**File Too Large**
- Check client-side limit (10MB)
- Check multer limit in `chat.js`
- Check reverse proxy limit (Nginx: `client_max_body_size`)

**File Not Attaching to Email**
- Verify files exist in permanent storage
- Check file paths in attachments array
- Verify base64 encoding successful

## Security Considerations

- ✅ File type validation (PDF, DOC, XLS, images only)
- ✅ File size limits (10MB per file, 50MB total)
- ✅ Email validation (frontend and backend)
- ✅ Session validation before processing
- ✅ One LOG request per conversation
- ✅ Multi-tenant isolation
- ✅ Automatic file cleanup
- ✅ User email cleared after request for privacy

## Monitoring

**Key Metrics:**
- Email send success rate
- File upload success rate
- Average email delivery time
- Storage usage
- LOG request frequency

**Logs to Monitor:**
- `backend/logs/error.log` - Failed email sends
- `backend/logs/combined.log` - All LOG requests

## Next Steps

1. ✅ **Configure Azure AD** - Add Mail.Send permission and grant consent
2. ✅ **Set Environment Variables** - Add email addresses and credentials
3. ✅ **Run Database Migration** - Create log_requests table in Supabase
4. ✅ **Test Email Sending** - Run `node test-email.js`
5. ✅ **Build Frontend** - Compile widget with new features
6. ✅ **Deploy Backend** - Ensure upload directories exist
7. ✅ **Test End-to-End** - Submit test LOG request from widget

## Support

For issues or questions:
- Check `claudedocs/LOG-REQUEST-EMAIL-WORKFLOW.md` for detailed documentation
- Review `claudedocs/LOG-REQUEST-EMAIL-ACKNOWLEDGMENT-SUMMARY.md` for feature details
- Check error logs in `backend/logs/`

---

**Implementation Status**: ✅ Complete and Ready for Testing

All components have been implemented. Follow the Quick Start guide above to configure and test the system.
