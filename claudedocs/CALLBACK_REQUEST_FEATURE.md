# Callback Request Feature Documentation

## Overview

The Callback Request feature allows users who cannot log in to the chatbot to submit their contact number for a callback from the support team. This provides an alternative support channel for users experiencing login issues.

## Features

### 1. User Interface
- **Location**: Login form widget (`frontend/widget/src/components/LoginForm.jsx`)
- **Input**: Contact number field with validation
- **Validation**: Accepts international phone formats (+65 9123 4567, etc.)
- **Feedback**: Success message after submission

### 2. Backend Processing
- **Endpoint**: `POST /api/chat/callback-request`
- **Database**: Stores requests in `callback_requests` table (per company schema)
- **Notifications**:
  - Email notification to support team
  - Telegram notification for immediate escalation

### 3. Admin Configuration
- **Location**: Companies page → Email Configuration modal
- **Settings**:
  - `callback_email_to`: Primary recipients for callback notifications
  - `callback_email_cc`: CC recipients (optional)
  - Falls back to LOG request email if not configured

## Database Schema

### callback_requests table (per company schema)

```sql
CREATE TABLE callback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_number VARCHAR(50) NOT NULL,
  employee_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_error TEXT,
  telegram_sent BOOLEAN DEFAULT false,
  telegram_sent_at TIMESTAMP WITH TIME ZONE,
  telegram_error TEXT,
  notes TEXT,
  contacted_at TIMESTAMP WITH TIME ZONE,
  contacted_by VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Status Values
- `pending`: Request submitted, awaiting contact
- `contacted`: Support team has contacted the user
- `resolved`: Issue resolved successfully
- `failed`: Unable to contact or resolve

## Installation & Setup

### 1. Run Database Migration

Execute the migration to add callback_requests table to existing company schemas:

```bash
# Run this SQL in Supabase SQL editor
psql -h [HOST] -U [USER] -d [DATABASE] -f backend/migrations/add_callback_requests_table.sql
```

Or manually in Supabase SQL editor:
```sql
-- See backend/migrations/add_callback_requests_table.sql for full script
```

### 2. Configure Company Email Settings

1. Go to Admin Panel → Companies
2. Click "Email Config" for your company
3. Scroll to "Callback Request Configuration"
4. Set callback notification emails (or leave empty to use LOG request emails)
5. Save configuration

### 3. Environment Variables

Ensure these are set in `.env`:

```env
# Azure Email Configuration (for email notifications)
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_secret
AZURE_TENANT_ID=your_azure_tenant_id
AZURE_SERVICE_ACCOUNT_USERNAME=serviceaccount@company.com
AZURE_SERVICE_ACCOUNT_PASSWORD=password
LOG_REQUEST_EMAIL_FROM=noreply@company.com

# Telegram Configuration (for instant notifications)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

### 4. Rebuild Widget

```bash
cd frontend/widget
npm run build
cp dist/widget.iife.js ../../backend/public/
cp dist/widget.css ../../backend/public/
```

### 5. Restart Backend Server

```bash
cd backend
npm run dev
```

## Usage Flow

### User Flow
1. User visits chatbot widget
2. User attempts to enter Employee ID but fails (invalid ID)
3. User sees error: "Invalid ID, please contact helpdesk at 64487707"
4. User scrolls down to "Request Callback" section
5. User enters contact number
6. User clicks "Submit Contact Number"
7. User sees success message: "Our team will contact you within the next working day"

### Support Team Flow
1. **Email Notification**:
   - Receives email with callback request details
   - Includes: Contact number, Employee ID (if provided), timestamp, company

2. **Telegram Notification**:
   - Instant message to Telegram group/channel
   - Format:
     ```
     🔔 Callback Request

     Contact Number: +65 9123 4567
     Employee ID: EMP123 (or "Not provided")
     Company: ACME Corp
     Status: 🟡 Pending Callback

     Request Time: [Singapore time]

     [Callback Request: abc123-...]

     📞 Please contact the user within the next working day.
     ```

3. **Action**: Support team contacts user within 1 business day

## API Reference

### POST /api/chat/callback-request

**Request Headers:**
- `Content-Type: application/json`
- `X-Widget-Domain: [domain]` (for multi-tenant routing)

**Request Body:**
```json
{
  "contactNumber": "+65 9123 4567",
  "employeeId": "EMP123" // Optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "requestId": "abc123-def456-...",
  "emailSent": true,
  "telegramSent": true,
  "message": "Callback request submitted successfully"
}
```

**Response (Error):**
```json
{
  "error": "Invalid contact number format"
}
```

**Status Codes:**
- `200 OK`: Request submitted successfully
- `400 Bad Request`: Invalid input (missing/invalid contact number)
- `500 Internal Server Error`: Server error

## Admin Features

### View Callback Requests

You can query callback requests in Supabase:

```sql
-- View all pending callbacks for a company
SELECT * FROM company_abc.callback_requests
WHERE status = 'pending'
ORDER BY created_at DESC;

-- View callback statistics
SELECT
  status,
  COUNT(*) as count,
  MAX(created_at) as latest_request
FROM company_abc.callback_requests
GROUP BY status;
```

### Update Callback Status

```sql
-- Mark as contacted
UPDATE company_abc.callback_requests
SET
  status = 'contacted',
  contacted_at = NOW(),
  contacted_by = 'John Doe',
  notes = 'Called user, resolved login issue'
WHERE id = '[request-id]';
```

## Email Template

The callback notification email uses the existing LOG request email template with customized content:

**Subject:** 🚨 LOG Request - Callback Request - N/A

**Body Includes:**
- Employee Information (shows "Callback Request")
- Contact number provided
- Employee ID (if provided)
- Request timestamp
- Company information

## Telegram Notification Format

```
🔔 Callback Request

Contact Number: +65 9123 4567
Employee ID: EMP123
Company: ACME Corp
Status: 🟡 Pending Callback

Request Time: 14/11/2025, 02:30:45 pm

[Callback Request: abc123|Schema: company_abc]

📞 Please contact the user within the next working day.
```

## Error Handling

### Validation Errors
- Empty contact number → "Contact number is required"
- Invalid format → "Please enter a valid contact number"
- API failure → "Failed to submit contact number. Please try again."

### Database Errors
- Callback request is still created even if email/Telegram fails
- Error details stored in `email_error` and `telegram_error` columns
- Support team can view failed notifications in database

### Email/Telegram Failures
- Non-blocking: Request is created successfully
- Error logged to database for troubleshooting
- Admin can check `email_sent`, `telegram_sent` flags

## Monitoring & Analytics

### Key Metrics to Track
1. **Callback Request Volume**: How many users need callbacks?
2. **Response Time**: How quickly are callbacks handled?
3. **Resolution Rate**: What % of callbacks lead to successful login?
4. **Common Issues**: What employee IDs are being provided?

### Sample Queries

```sql
-- Daily callback requests
SELECT
  DATE(created_at) as date,
  COUNT(*) as requests,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved
FROM company_abc.callback_requests
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Average response time
SELECT
  AVG(EXTRACT(EPOCH FROM (contacted_at - created_at))/3600) as avg_hours
FROM company_abc.callback_requests
WHERE contacted_at IS NOT NULL;
```

## Future Enhancements

### Potential Improvements
1. **SMS Notifications**: Send SMS to user confirming callback request
2. **Callback Scheduling**: Allow user to specify preferred callback time
3. **Admin Dashboard**: Visual interface to manage callback requests
4. **Auto-Assignment**: Automatically assign callbacks to support team members
5. **Follow-up Tracking**: Track multiple contact attempts
6. **Integration with CRM**: Sync callback requests with existing CRM systems

## Troubleshooting

### Issue: Emails not being sent
**Solution:**
1. Check Azure credentials in `.env`
2. Verify `LOG_REQUEST_EMAIL_FROM` is configured
3. Check company email configuration in admin panel
4. View error details in `callback_requests.email_error`

### Issue: Telegram notifications not working
**Solution:**
1. Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`
2. Ensure Telegram bot is started: `/start` command
3. Check bot has permission to send messages to the chat
4. View error in `callback_requests.telegram_error`

### Issue: Widget not showing callback form
**Solution:**
1. Rebuild widget: `cd frontend/widget && npm run build`
2. Copy files to backend: `cp dist/* ../../backend/public/`
3. Clear browser cache
4. Check browser console for errors

### Issue: Contact number validation failing
**Solution:**
1. Ensure number has at least 8 digits
2. Supports formats: +65 9123 4567, (65) 9123-4567, 91234567
3. Check regex: `/^\+?[\d\s\-()]{8,}$/`

## Security Considerations

1. **Rate Limiting**: Consider implementing rate limits to prevent spam
2. **Phone Number Validation**: Validates format but doesn't verify if number is real
3. **PII Protection**: Contact numbers are sensitive data - ensure proper access controls
4. **Email Security**: Uses Azure ROPC flow with service account (secure)
5. **Telegram Security**: Bot token should be kept secret
6. **Multi-tenancy**: Requests are properly isolated by company schema

## Support

For issues or questions:
1. Check this documentation
2. Review database logs for error details
3. Check backend server logs: `console.log` messages
4. Contact development team

---

**Version:** 1.0
**Last Updated:** November 2025
**Author:** Development Team
