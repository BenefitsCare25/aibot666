# LOG Route Configuration (Per-Company)

Per-company LOG request routes stored in `company.settings.logConfig` JSONB. Managed via Admin Portal → Company Management → 📋 button → **LOG Configuration modal**.

## Data Structure (`settings.logConfig`)

```json
{
  "routes": [
    {
      "id": "govt-hospital",
      "label": "Govt / Restructured Hospital",
      "requiredDocuments": [
        { "name": "Hospital Care Cost Form", "description": "Obtained from the hospital", "downloadKey": null },
        { "name": "LOG Request Form", "description": "Download and complete this form", "downloadKey": "log-form" }
      ]
    }
  ],
  "downloadableFiles": {
    "log-form": { "fileName": "LOG_Request_Form.pdf", "base64": "<base64>", "mimeType": "application/pdf", "size": 140000 }
  }
}
```

## How It Works

1. `GET /api/chat/config` returns `logConfig` (routes + file metadata, NO base64 data) or `null`
2. `GET /api/chat/log-form/:fileKey` serves downloadable PDFs (reads base64 from settings, returns as binary attachment)
3. `chatStore.js` stores `logConfig` from fetchConfig response
4. `LoginForm.jsx` determines flow based on route count:
   - **No logConfig** → default LogRequestForm (backward compatible)
   - **1 route** → auto-selected, document checklist shown above form
   - **2+ routes** → LogRouteSelector shown first → user picks → then form with docs
5. `LogRequestForm.jsx` displays route label, required document checklist, and download links when `logRoute` prop is present
6. `POST /api/chat/anonymous-log-request` accepts optional `logRoute` field → stored in `metadata.logRoute` → route label included in support email (includes company name in subject and body)

## Document Upload Validation (2026-03-24)

When a LOG route has `requiredDocuments`, uploaded files are validated on **both frontend and backend** using identical token-overlap matching:
- **Shared logic**: `validateLogAttachments()` in `LoginForm.jsx` (frontend) and `backend/api/utils/logAttachmentValidation.js` (backend) — must be kept in sync
- **Token-overlap matching**: expected doc names are tokenized (stopwords removed), uploaded filenames must share ≥2 meaningful tokens with any expected document to pass
- **Blocklist regex**: `receipt|claim|invoice|reimburse|\bmc\b|medical.cert|payment` → immediately blocked
- **Frontend**: validation runs on submit click → amber warning shown, submission blocked
- **Backend**: `POST /anonymous-log-request` validates before DB insert → returns 400 with error code (`ATTACHMENT_REQUIRED`, `ATTACHMENT_BLOCKLIST`, `ATTACHMENT_NO_MATCH`)
- No files uploaded → "Please upload the required LOG document(s) before submitting."
- Wrong files uploaded → "Please submit other claims on the portal."
- Frontend warnings auto-clear when user changes attachments (useEffect on `logAttachments`)
- No validation when `requiredDocuments` is absent or `logRoute` is null (backward compatible)

## LOG Form PDF Download (postMessage Delegation)

Widget delegates downloads to the parent page via `postMessage`:
1. Widget sends `{ type: 'chatWidgetDownload', url, filename }` to `window.parent`
2. `embed-helper.js` (running in the unsandboxed parent) catches the message, creates a hidden `<a>` element with `href` pointing to the download URL, and clicks it programmatically
3. Server returns `Content-Disposition: attachment` → browser downloads the file without navigating away

**Why `<a>` navigation, not `fetch+blob`:** Parent pages (e.g., Inspro) may have strict CSP headers (`connect-src 'self'`) that block `fetch()` to external domains. `<a>` navigation is NOT restricted by `connect-src`.

**Rule:** Never use `fetch+blob+a.click()` or `window.open()` for downloads from within the widget iframe. Always delegate to the parent via postMessage using `<a>` navigation.

## Backend Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/log-form/:fileKey` | Serve downloadable PDF from company settings |

## Admin Portal

- 📋 button per company row → LogConfigModal
- Add/edit/remove/reorder routes
- Add/remove required documents per route
- Toggle downloadable flag + set download key
- Upload PDF files (max 2MB, stored as base64 in settings)
