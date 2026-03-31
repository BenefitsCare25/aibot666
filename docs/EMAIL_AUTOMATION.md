# Email Automation (Super Admin Only)

Manages monthly panel listing reminder emails to insurance/health providers. Accessible via Admin Portal sidebar → **📧 Email Automation** (super admin only).

## Database Table (public schema)

```sql
public.email_automations (
  id UUID PRIMARY KEY,
  portal_name TEXT,
  listing_type TEXT,
  recipient_email TEXT NOT NULL,   -- newline or comma-separated, may be mailto: hyperlinks in Excel
  cc_list TEXT,
  recipient_name TEXT NOT NULL,
  body_content TEXT NOT NULL,
  subject TEXT NOT NULL,
  recurring_day INTEGER (1–28),    -- day of month for monthly sends
  scheduled_date DATE,             -- one-time send date
  send_time TEXT DEFAULT '08:00',  -- HH:MM in Singapore time
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Migration for send_time** (run once in Supabase SQL editor):
```sql
ALTER TABLE public.email_automations ADD COLUMN IF NOT EXISTS send_time TEXT DEFAULT '08:00';
```

## Scheduler

- Cron runs **every minute** (`* * * * *`) — lightweight Supabase query each tick
- Sends emails where: `is_active=true` AND (`scheduled_date=today` OR `recurring_day=todayDay`) AND `send_time=currentHH:MM (SGT)` AND NOT already sent today at or after the scheduled time
- **Duplicate send guard**: skips only if `last_sent_at` (converted to SGT) is same day AND time ≥ `send_time`. A manual "Send Now" before the scheduled time does NOT block the scheduled trigger.
- One Graph API client created per cron run (shared across all emails — single token request)
- Cron wrapped in try/catch — failures log but never crash the Express process

## Template Variables

`<<current month>>` / `<<Current Month>>` → e.g. "March" (case-insensitive)
`<<current year>>` / `<<Current Year>>` → e.g. "2026"

Email body sent as: `Dear [recipientName],<br><br>[resolved body with \n → <br>]`

## Excel Import

Sheet name: **"Email Automation"** (falls back to first sheet if not found).

Expected column headers (case-insensitive, typo-tolerant):
| DB Field | Accepted Headers |
|----------|-----------------|
| `recipient_email` | "Recipient Email", **"Recipent Email"** (typo in source file), "email", "to" |
| `cc_list` | "CC list", "cc" |
| `recipient_name` | "Recipient Name", "name" |
| `body_content` | "Body Email Content", "body content", "body" |
| `subject` | "Email Subject", "subject" |
| `portal_name` | "Portal Name", "portal" |
| `listing_type` | "Listing Type", "type" |
| `send_time` | "Send Time", "time" |

**Import flow (2-step)**:
1. Select file → click **Validate & Preview** → calls `POST /import/preview` → shows column detection status + first 3 records
2. If no errors → click **Import N Records** → calls `POST /import` → inserts new / updates existing (matched by `portal_name`)

**Hyperlink handling**: ExcelJS returns mailto: links as `{text, hyperlink}` objects — `getCellText()` extracts `.text` property.

## API Endpoints

All require `requireSuperAdmin`. Use public `supabase` client (not `req.supabase`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/email-automation` | List all records |
| POST | `/api/admin/email-automation` | Create record |
| PUT | `/api/admin/email-automation/:id` | Update record |
| DELETE | `/api/admin/email-automation/:id` | Delete record |
| POST | `/api/admin/email-automation/:id/send` | Immediate send |
| POST | `/api/admin/email-automation/import/preview` | Validate Excel (no insert) |
| POST | `/api/admin/email-automation/import` | Import Excel |
