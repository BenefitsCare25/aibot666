# AI Chatbot Project - Claude Code Instructions

## Project Overview

This is a multi-tenant AI chatbot widget embedded via iframe on client websites (e.g., Inspro, CBRE). Each tenant gets a schema-isolated Supabase database with vector search (pgvector) for RAG-powered responses.

**Stack:** Express.js backend (Azure Web App) | React + Zustand widget (IIFE bundle) | React admin portal (Azure Static Web Apps) | Supabase (PostgreSQL + pgvector) | Redis (Azure) + BullMQ | OpenAI

## Backend Architecture

### Route Structure

```
backend/
├── server.js                          # Express app, CSP headers, SRI hash TTL cache (60s), /chat page
├── config/
│   ├── supabase.js                    # Supabase clients, LRU schema cache (max 50)
│   └── redis.js                       # Shared parseRedisUrl(), Redis connection config
├── api/
│   ├── middleware/
│   │   ├── companyContext.js           # Domain → company resolution (memory cache 60s + Redis)
│   │   └── authMiddleware.js          # JWT auth, requireSuperAdmin
│   ├── routes/
│   │   ├── admin/                     # Split from monolithic admin.js
│   │   │   ├── index.js              # Router aggregator, middleware ordering, template downloads
│   │   │   ├── employees.js          # Employee CRUD, bulk ops, Excel upload
│   │   │   ├── knowledge.js          # Knowledge base CRUD, batch, Excel upload
│   │   │   ├── escalations.js        # Escalation listing, status updates
│   │   │   ├── companies.js          # Company CRUD, schema creation, embed code
│   │   │   ├── chatHistory.js        # Conversation listing, messages, attendance
│   │   │   ├── analytics.js          # Usage analytics, trends, frequent categories
│   │   │   ├── quickQuestions.js      # Quick questions CRUD, bulk import, Excel
│   │   │   ├── emailAutomation.js    # Email automation CRUD, send-now, import/preview (superAdmin only)
│   │   │   └── debug.js              # Diagnostics (requireSuperAdmin protected)
│   │   ├── chat.js                    # Chat session, messages, intent-aware RAG flow, callbacks, /config, /log-form/:fileKey
│   │   ├── auth.js                    # Login (with lockout), token refresh
│   │   ├── documents.js              # Document upload (PDF/DOCX/TXT/CSV), bulk upload, processing status, metadata edit
│   │   └── adminUsers.js             # Admin user management
│   ├── services/
│   │   ├── knowledgeService.js        # Knowledge base CRUD + vector search
│   │   ├── employeeService.js         # Employee CRUD + identifier lookup
│   │   ├── vectorDB.js               # Re-export shim (backward compat for both above)
│   │   ├── escalationService.js       # Escalation handling, contact detection
│   │   ├── callbackService.js         # Callback email + Telegram notifications
│   │   ├── emailAutomationService.js  # resolveTemplateVars, buildAutomationEmail, sendAutomationEmail, runScheduledCheck
│   │   ├── companySchema.js           # Company lookup (indexed: exact → ilike → additional_domains)
│   │   ├── documentProcessor.js       # Multi-format extraction (PDF/DOCX/TXT/CSV), cleanTitle/cleanText utilities, structure-aware chunking with quality filters, embedding
│   │   ├── visionExtractor.js         # GPT-4.1-mini vision interpretation for PDFs (page→image→natural language with [SECTION:] markers)
│   │   ├── jobQueue.js               # BullMQ document processing queue
│   │   ├── telegram.js               # Telegram bot notifications
│   │   └── excel.js                  # Excel import/export
│   ├── utils/
│   │   ├── session.js                # Redis sessions (pipeline ops, conv: reverse lookup, query cache + semantic cache)
│   │   ├── redisClient.js            # ioredis singleton
│   │   ├── auth.js                   # JWT_SECRET (no fallback, throws if unset)
│   │   ├── sanitize.js               # Search param sanitization (SQL injection prevention)
│   │   ├── fileValidation.js          # Magic bytes validation (PDF, JPEG, PNG, GIF, XLSX)
│   │   ├── logAttachmentValidation.js # LOG upload token-overlap validation (mirrors frontend)
│   │   ├── validation.js             # Shared EMAIL_REGEX, isValidEmail()
│   │   ├── pagination.js             # parsePagination(), paginationResponse() (cap: 200)
│   │   ├── quickQuestionUtils.js      # groupQuestionsByCategory()
│   │   └── response.js               # successResponse(), errorResponse()
│   └── workers/
│       └── documentWorker.js          # BullMQ worker for document processing (step-level progress: extracting→chunking→categorizing→embedding→storing)
└── public/
    ├── widget.iife.js                 # Compiled widget (auto-generated)
    ├── widget.css                     # Compiled styles (auto-generated)
    ├── embed-helper.js                # Iframe resize/fullscreen handler
    ├── sri-hashes.json                # SRI integrity hashes (auto-generated)
    └── test-iframe-mobile.html        # Test page
```

### Key Middleware Order (admin/index.js)

Routes defined **before** `companyContextMiddleware`: `db-test`, template downloads.
`/companies` prefix gets `adminContextMiddleware` (public schema).
`/email-automation` prefix skips `companyContextMiddleware` (uses public `supabase` client directly — not tenant-scoped).
All other admin routes get `companyContextMiddleware` (tenant schema).

### Security Features

- **JWT**: No hardcoded fallback — server throws on startup if `JWT_SECRET` unset
- **Account lockout**: 5 failed logins → 15min Redis-based lockout
- **CSP headers**: Enabled (`script-src 'self' 'unsafe-inline'`, `frame-ancestors *`)
- **Search sanitization**: All admin search params stripped of SQL metacharacters
- **File validation**: Magic bytes checked on upload (PDF, images, XLSX)
- **Query limits**: All pagination capped at 200
- **Debug endpoints**: Protected by `requireSuperAdmin`
- **Error messages**: Hidden in production (`NODE_ENV=production`)
- **Domain spoofing**: Origin mismatch logged as warning
- **Color param XSS**: Validated against `/^#[0-9a-fA-F]{3,8}$/`
- **X-Frame-Options**: `DENY` on all routes except `/chat` (iframe embed) and `/api/chat/log-form/*` (file downloads opened in new tabs)
- **LOG upload validation**: Frontend + backend token-overlap matching blocks non-LOG documents from being submitted (`logAttachmentValidation.js`)

### Performance Features

- **Session lookup**: `conv:{conversationId}` reverse key instead of `redis.keys()` scan
- **Redis pipelines**: `touchSession` and `addMessageToHistory` batch commands
- **SRI hashes**: TTL cache (re-reads from disk every 60s) — survives deploys without restart. Startup validation logs `[SRI] MISMATCH` if hashes don't match files
- **Company lookup**: Indexed query (exact → ilike → additional_domains) instead of loading all
- **Schema client cache**: LRU bounded at 50 entries
- **Company cache**: Two-tier (in-memory 60s TTL → Redis) with periodic cleanup
- **Post-response ops**: `Promise.all` for DB save + session touch after OpenAI response
- **Employee lookup**: Single `.or()` query instead of 3 sequential queries
- **Intent classification**: Greetings/conversational messages skip KB search entirely (no embedding + pgvector cost)
- **Query cache**: Namespaced per company (`query:{schemaName}:{hash}`) — PDPA-compliant, no cross-tenant hits. TTL 3600s. Invalidated on any KB mutation (create/update/delete/Excel upload) via `invalidateCompanyQueryCache()` using Redis SCAN (non-blocking)
- **Semantic cache**: Paraphrase matching using cosine similarity on stored embeddings (`query:embed:{schemaName}:{hash}`). Index tracked in `query:index:{schemaName}` Redis SET. Threshold: 0.95. Embedding generated once per `domain_question` and reused for both semantic cache check and `searchKnowledgeBase()` — zero extra OpenAI calls on cache miss

## Widget Architecture

```
frontend/widget/src/
├── ChatWidget.jsx                     # Main component, iframe resize via postMessage
├── index.css                          # Tailwind + custom styles
├── components/
│   ├── LoginForm.jsx                  # State machine coordinator, non-blocking disclaimer, feature-flag auto-select
│   ├── login/
│   │   ├── OptionSelector.jsx         # Chat vs LOG option cards (conditional per companyFeatures)
│   │   ├── ChatLoginForm.jsx          # Employee ID login form
│   │   ├── LogRequestForm.jsx         # LOG request with file upload + per-route document checklist
│   │   ├── LogRouteSelector.jsx       # Hospital type route selection cards (multi-route LOG config)
│   │   ├── CallbackForm.jsx           # Contact number callback
│   │   └── SuccessScreen.jsx          # Confirmation message
│   ├── PrivacyPolicyModal.jsx         # Terms of Use modal (13 sections, Inspro-specific)
│   ├── ChatWindow.jsx                 # Chat interface
│   ├── ChatButton.jsx                 # Floating button
│   ├── MessageInput.jsx               # Input area
│   ├── MessageList.jsx                # Message display
│   ├── QuickQuestions.jsx             # Quick question cards
│   └── FileAttachment.jsx            # File upload (uses onError callback, no alert())
└── store/
    └── chatStore.js                   # Zustand state (crypto.randomUUID IDs, error state, companyFeatures, logConfig)
```

## Widget Deployment

### How Client Updates Work Automatically

Clients use an **iframe embed** approach. Only iframe embed is supported.

1. **Widget files are hosted on Azure**: `https://app-aibot-api.azurewebsites.net/`
2. **Clients only reference our hosted files** - they don't host widget code themselves
3. **Any updates we push automatically apply** to all client sites

### Client Embed Code

Get from **Admin Portal → Company Management → `</> Embed Codes` button** (top-right of page).

Two implementation types are available:

#### Dynamic (SPA / multi-company hosts)
For sites where multiple companies share the same host, distinguished by URL path (e.g. Inspro vendor portal). Uses `window.location.hostname` at runtime — **one snippet works on both production and staging automatically**. No hardcoded host in the snippet.

```html
<script>
  (function() {
    var companyMap = {
      "/cbre": { id: "<CBRE_UUID>", color: "%233b82f6" },
      "/stm":  { id: "<STM_UUID>",  color: "%233b82f6" }
    };
    var path = window.location.pathname.replace(/\/$/, "");
    var company = companyMap[path];
    if (!company) return;
    var domain = encodeURIComponent(window.location.hostname + path);
    var src = "https://app-aibot-api.azurewebsites.net/chat"
      + "?company=" + company.id + "&domain=" + domain + "&color=" + company.color;
    var iframe = document.createElement("iframe");
    iframe.id = "chat-widget-iframe";
    iframe.src = src;
    iframe.style.cssText = "position:fixed;bottom:16px;right:16px;width:200px;height:80px;border:none;background:transparent;z-index:9999;transition:all 0.3s ease;";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-downloads");
    iframe.setAttribute("allow", "clipboard-write");
    iframe.setAttribute("allowtransparency", "true");
    iframe.title = "Chat Widget";
    document.body.appendChild(iframe);
  })();
</script>
<script src="https://app-aibot-api.azurewebsites.net/embed-helper.js"></script>
```

- **`companyMap`** is auto-generated with real UUIDs and paths from all registered companies
- **`window.location.hostname`** resolves to the actual host at runtime (production or staging)
- Backend matches the domain against primary domain or additional domains to find the company
- Paste the same snippet on both production and staging — no separate versions needed

#### Static (standalone pages)
For sites with one company per page. Hardcoded company ID and domain. One snippet per company per domain (production and staging shown separately in the modal).

```html
<iframe
  id="chat-widget-iframe"
  src="https://app-aibot-api.azurewebsites.net/chat?company=<UUID>&domain=<ENCODED_DOMAIN>&color=%233b82f6"
  style="position: fixed; bottom: 16px; right: 16px; width: 200px; height: 80px; border: none; background: transparent; z-index: 9999; transition: all 0.3s ease;"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
  allow="clipboard-write"
  allowtransparency="true"
  title="Company Name Chat Widget">
</iframe>
<script src="https://app-aibot-api.azurewebsites.net/embed-helper.js"></script>
```

### Embed Code UI (`EmbedCodeModal.jsx`)

- **Single global button** (`</> Embed Codes`) in Company Management header — not per-row
- **Dynamic tab**: groups companies by shared hosts using union-find (companies sharing any host → one snippet). Only SPA companies (path-based domains) appear here.
- **Static tab**: one card per company, one code block per domain (primary = Production, additional = Staging)
- All UUIDs, paths, and domains are populated from live DB data — ready to copy-paste
- `VITE_API_URL` env var sets the API base URL in generated snippets

### How to Update the Widget

```bash
cd backend && npm run build-widget    # Build + copy + regenerate SRI hashes
```

Widget is also built automatically in CI/CD (GitHub Actions) on every push to `main` that touches `backend/**` or `frontend/widget/**`. SRI hashes are regenerated as part of the CI build, so even if you forget to build locally, the deployed version will always have matching hashes.

### Embed Code Backend Endpoint

`GET /api/admin/companies/:id/embed-code` — used only to retrieve `apiUrl` for the modal. All snippet generation is done client-side in `EmbedCodeModal.jsx` from the companies list.

## Admin Portal

```
frontend/admin/src/
├── api/
│   ├── client.js                      # Axios client + downloadFile() helper
│   ├── employees.js                   # Employee API
│   ├── knowledge.js                   # Knowledge base + document upload API (single/bulk upload, metadata edit)
│   ├── quickQuestions.js              # Quick questions API
│   ├── emailAutomation.js             # Email automation API (getAll, create, update, remove, sendNow, importPreview, importExcel)
│   └── companies.js                   # Company API (CRUD, status, email-config, embed-code)
├── components/
│   ├── EmailConfigModal.jsx            # LOG + callback email config per company
│   ├── EmbedCodeModal.jsx             # Dynamic + static embed snippet generator
│   └── LogConfigModal.jsx            # LOG route config per company (hospital types, required docs, PDF uploads)
└── pages/
    ├── Companies.jsx                  # Company management (CRUD, status toggle, email config, LOG config)
    ├── KnowledgeBase.jsx              # Knowledge base management + multi-format document upload (PDF/DOCX/TXT/CSV), bulk upload, step progress, metadata editing
    ├── Employees.jsx                  # Employee management
    ├── QuickQuestions.jsx             # Quick questions management
    └── EmailAutomation.jsx            # Email automation (superAdmin only) — table, edit modal, import with validation preview
```

## Iframe Dynamic Resize Mechanism

**Part 1: Widget sends size** (`ChatWidget.jsx`):
```javascript
window.parent.postMessage({
  type: 'chatWidgetResize',
  width: 380,
  height: calculatedHeight,
  state: 'open'
}, '*');
```

**Part 2: Parent resizes iframe** (`embed-helper.js`):
```javascript
window.addEventListener('message', function(event) {
  if (event.data.type === 'chatWidgetResize') {
    iframe.style.width = event.data.width + 'px';
    iframe.style.height = event.data.height + 'px';
  }
});
```

**Size states:**
| State | Width | Height |
|-------|-------|--------|
| Closed (button + tooltip) | 300px | 88px |
| Open - Teaser | 380px | ~280px |
| Open - Form | 380px | up to 850px |
| Mobile Open | 100vw | 100dvh |

**Adding new content components:** Add `data-chat-content` attribute to root element, avoid fixed heights, test resize behavior.

**PostMessage types handled by `embed-helper.js`:**
| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `chatWidgetResize` | Widget → Parent | Resize iframe to fit widget content |
| `chatWidgetDownload` | Widget → Parent | Delegate file download (iframe sandbox blocks direct downloads) |
| `chatWidgetParentInfo` | Parent → Widget | Send parent viewport width + isMobile flag |

## Multi-Tenant Domain Routing

Detection order: `domain` URL param → `document.referrer` → `window.location.hostname`

For multi-tenant sites with paths (e.g., `benefits-staging.inspro.com.sg/cbre`), the `domain` param is required because cross-origin referrers strip the path.

The `normalizeDomain()` function in `companySchema.js` removes protocol, `www.`, trailing slash, and preserves path.

**Debugging:**
```bash
curl -s "https://app-aibot-api.azurewebsites.net/api/chat/session" \
  -H "X-Widget-Domain: YOUR_DOMAIN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test"}'
```
- `"Employee not found"` = Domain works, company found
- `"Company not found for this domain"` = Domain mismatch

### Inspro Vendor Portal (SPA — confirmed 2026-02-20)

Both `benefits.inspro.com.sg` and `benefits-staging.inspro.com.sg` are **SPAs** — confirmed by curl:
- Single `<div id="app">` with no server-rendered content
- Same JS bundle hash served for all company paths (`/cbre`, `/STM`, etc.)
- Staging is ahead of prod: `env.js v4.4` vs `v4.3`, staging has service worker + PWA manifest

**Implication:** Static per-company embed code won't work. Use the **Dynamic** snippet from Admin Portal → Embed Codes.

**Company domain registration in Admin Portal:**
- Primary Domain → production path (e.g., `benefits.inspro.com.sg/cbre`)
- Additional Domains → staging path (e.g., `benefits-staging.inspro.com.sg/cbre`)

**Dynamic snippet** (get from Admin Portal → `</> Embed Codes` → Dynamic tab):
- Uses `window.location.hostname` — **one snippet works on both production and staging**
- `companyMap` is auto-generated with all registered companies' real UUIDs and paths
- Paste the same snippet on both `benefits.inspro.com.sg` and `benefits-staging.inspro.com.sg`

**How the domain resolves at runtime:**
- On production: `window.location.hostname` = `benefits.inspro.com.sg` → backend matches primary domain
- On staging: `window.location.hostname` = `benefits-staging.inspro.com.sg` → backend matches additional domain

**Adding a new company:** Register it in Admin Portal with correct primary + additional domains → open Embed Codes modal → copy updated Dynamic snippet → send to vendor to replace the old one (single re-paste on each environment).

## Environment Variables (Required)

- `JWT_SECRET` — **Required**, server crashes on startup if unset
- `REDIS_URL` — Redis connection (supports `rediss://` for TLS)
- `REDIS_TLS_REJECT_UNAUTHORIZED` — Set to `'false'` to disable TLS cert validation
- `PG_SSL_REJECT_UNAUTHORIZED` — Set to `'false'` to disable PostgreSQL SSL cert validation
- `NODE_ENV` — Set to `'production'` to hide error details from clients

## Deployment

- **Backend**: Azure Web App (`app-aibot-api.azurewebsites.net`)
- **Admin Portal**: Azure Static Web Apps
- **Auto-deploy**: Push to `main` triggers GitHub Actions (triggers on `backend/**` or `frontend/widget/**` changes)
- **CI/CD pipeline**: Install widget deps (npm cached) → build widget + SRI hashes → install backend deps (npm cached) → deploy to Azure
- **Deploy time**: ~4-5 min total (build ~35s cached, Azure upload+restart ~4min)
- **GitHub account**: `BenefitsCare25` (switch with `gh auth switch --user BenefitsCare25`)

## Testing

- **Widget test page**: `https://app-aibot-api.azurewebsites.net/test-iframe-mobile.html`
- **Admin portal**: `https://gray-flower-0e68c8a00-preview.eastasia.6.azurestaticapps.net/`

## Company Email Configuration

Per-company email settings stored as **top-level columns** on the `companies` table (not in the `settings` JSONB). Managed via Admin Portal → Company Management → 📧 button → **Email Configuration modal**.

| Column | Purpose |
|--------|---------|
| `log_request_email_to` | TO recipients for LOG request notifications (required) |
| `log_request_email_cc` | CC recipients for LOG request notifications (optional) |
| `log_request_keywords` | Keywords that trigger a LOG email (array) |
| `callback_email_to` | TO recipients for callback request notifications (optional, falls back to `log_request_email_to`) |
| `callback_email_cc` | CC recipients for callback notifications (optional, falls back to `log_request_email_cc`) |

**Backend endpoint**: `PATCH /api/admin/companies/:id/email-config` — saves all five fields, validates email format, invalidates company cache.

**Callback email fallback** (`callbackService.js`): if `callback_email_to` is null, falls back to `log_request_email_to`. Same for CC. So LOG email is the minimum required config for both flows.

**Email sending**: Microsoft Graph API (ROPC flow) via `email.js`. Requires `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_SERVICE_ACCOUNT_USERNAME`, `AZURE_SERVICE_ACCOUNT_PASSWORD`, `LOG_REQUEST_EMAIL_FROM`.

## Company Widget Feature Flags

Per-company toggles stored in `company.settings` JSONB. Controlled via Admin Portal → Company Management → Edit → **Widget Options** checkboxes.

| Setting key | Default | Effect |
|-------------|---------|--------|
| `showChat` | `true` | Shows "Send us a message" option in OptionSelector |
| `showLog` | `true` | Shows "Request Letter of Guarantee" option in OptionSelector |

**How it works:**
1. `GET /api/chat/config` reads `req.company.settings` and returns `{ features: { showChat, showLog } }` (both default `true`)
2. `ChatWidget.jsx` calls `fetchConfig()` on mount; result stored in `companyFeatures` Zustand state
3. `LoginForm.jsx` receives `companyFeatures` prop; auto-selects the sole available option if one is disabled (skips OptionSelector entirely)
4. `OptionSelector.jsx` conditionally renders each button based on `showChat`/`showLog` props
5. Admin saves flags via Edit form — checkboxes are authoritative and override any `showChat`/`showLog` values in the raw Settings JSON textarea. Toggling a checkbox immediately syncs the textarea.

**Edge cases:**
- Both disabled → OptionSelector not rendered (neither option shown)
- Only Chat enabled → auto-selects chat form, skips option screen
- Only LOG enabled → auto-selects LOG form, skips option screen
- Network error on `/config` → defaults to both enabled

## LOG Route Configuration (Per-Company)

Per-company LOG request routes stored in `company.settings.logConfig` JSONB. Managed via Admin Portal → Company Management → 📋 button → **LOG Configuration modal**.

**Data structure** (`settings.logConfig`):
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

**How it works:**
1. `GET /api/chat/config` returns `logConfig` (routes + file metadata, NO base64 data) or `null`
2. `GET /api/chat/log-form/:fileKey` serves downloadable PDFs (reads base64 from settings, returns as binary attachment)
3. `chatStore.js` stores `logConfig` from fetchConfig response
4. `LoginForm.jsx` determines flow based on route count:
   - **No logConfig** → default LogRequestForm (backward compatible)
   - **1 route** → auto-selected, document checklist shown above form
   - **2+ routes** → LogRouteSelector shown first → user picks → then form with docs
5. `LogRequestForm.jsx` displays route label, required document checklist, and download links when `logRoute` prop is present
6. `POST /api/chat/anonymous-log-request` accepts optional `logRoute` field → stored in `metadata.logRoute` → route label included in support email (includes company name in subject and body)

**Document upload validation (2026-03-24):**
When a LOG route has `requiredDocuments`, uploaded files are validated on **both frontend and backend** using identical token-overlap matching:
- **Shared logic**: `validateLogAttachments()` in `LoginForm.jsx` (frontend) and `backend/api/utils/logAttachmentValidation.js` (backend) — must be kept in sync
- **Token-overlap matching**: expected doc names are tokenized (stopwords removed), uploaded filenames must share ≥2 meaningful tokens with any expected document to pass
- **Blocklist regex**: `receipt|claim|invoice|reimburse|\bmc\b|medical.cert|payment` → immediately blocked
- **Frontend**: validation runs on submit click → amber warning shown, submission blocked
- **Backend**: `POST /anonymous-log-request` validates before DB insert → returns 400 with error code (`ATTACHMENT_REQUIRED`, `ATTACHMENT_BLOCKLIST`, `ATTACHMENT_NO_MATCH`)
- No files uploaded → "Please upload the required LOG document(s) before submitting."
- Wrong files uploaded → "Please submit other claims on the portal."
- At least one correct LOG document present → submission proceeds normally
- Frontend warnings auto-clear when user changes attachments (useEffect on `logAttachments`)
- No validation when `requiredDocuments` is absent or `logRoute` is null (backward compatible)

**LOG form PDF download (postMessage delegation):**
Downloads from within a sandboxed cross-origin iframe are blocked by browsers — the `allow-downloads` sandbox flag is required, and **modifying the sandbox attribute at runtime does NOT retroactively apply to already-loaded content** (HTML spec limitation — only affects future navigations).

Solution: Widget delegates downloads to the parent page via `postMessage`:
1. Widget sends `{ type: 'chatWidgetDownload', url, filename }` to `window.parent`
2. `embed-helper.js` (running in the unsandboxed parent) catches the message, creates a hidden `<a>` element with `href` pointing to the download URL, and clicks it programmatically
3. Server returns `Content-Disposition: attachment` → browser downloads the file without navigating away
4. Works with all existing client embeds — no sandbox or CSP changes needed on client side

**Why `<a>` navigation, not `fetch+blob`:** Parent pages (e.g., Inspro) may have strict CSP headers (`connect-src 'self'`) that block `fetch()` to external domains. `<a>` navigation is NOT restricted by `connect-src` — it's a navigation, not a connection.

**Rule:** Never use `fetch+blob+a.click()` or `window.open()` for downloads from within the widget iframe. Always delegate to the parent via postMessage. The download handler lives in `embed-helper.js` and must use `<a>` navigation (not `fetch`) to avoid parent CSP restrictions.

**Backend endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/log-form/:fileKey` | Serve downloadable PDF from company settings |

**Admin Portal:**
- 📋 button per company row → LogConfigModal
- Add/edit/remove/reorder routes
- Add/remove required documents per route
- Toggle downloadable flag + set download key
- Upload PDF files (max 2MB, stored as base64 in settings)

## Multi-Tenant Infrastructure (Self-Hosted Supabase on Azure VM)

**Supabase** runs self-hosted on Azure VM (`104.214.186.142`) via Docker Compose at `~/supabase/docker`.

### PostgREST Schema Exposure (Automatic)

PostgREST 13.0.7 is configured with **in-database config** — new company schemas are automatically exposed to the API when a company is created. No manual VM access needed.

**How it works:**
1. Company created in admin portal → `createCompanySchema()` runs
2. Schema created in PostgreSQL (tables, indexes, RLS) ✓
3. Schema name inserted into `pgrst_config.db_schemas` table ✓
4. `NOTIFY pgrst, 'reload config'` sent → PostgREST picks up new schema instantly ✓

**VM `.env` config (one-time, already set):**
```
PGRST_DB_SCHEMAS=${PGRST_DB_SCHEMAS}   # base list (fallback)
PGRST_DB_PRE_CONFIG=pgrst_config.pre_config  # enables in-database config
```

**Database objects (already created):**
- `pgrst_config.db_schemas` table — stores all exposed schema names
- `pgrst_config.pre_config()` function — called by PostgREST on startup + config reload

**Verify schemas exposed:**
```sql
SELECT string_agg(schema_name, ', ' ORDER BY schema_name) FROM pgrst_config.db_schemas;
```

**If PostgREST needs manual restart** (e.g. after VM reboot):
```bash
ssh -i supabase-vm-key.pem azureuser@104.214.186.142
cd ~/supabase/docker
docker compose restart rest
```

**Setup reference:** `backend/config/pgrst-config-setup.sql` — run this if rebuilding VM from scratch.

### SSH Access to Azure VM
- Key file: `supabase-vm-key.pem` (in local `azurevm/` folder)
- NSG rule: SSH port 22 restricted to specific source IP — update NSG if your IP changes
- Default user: `azureuser`

## Document Processing Pipeline (RAG Ingestion)

### Supported Formats
PDF, DOCX, TXT, CSV — max 25MB each, up to 10 files bulk upload.

### Processing Flow
```
Upload (single or bulk)
  ↓
SHA-256 hash check → 409 if duplicate
  ↓
BullMQ queue → documentWorker.js (5 concurrent workers)
  ↓
extracting → chunking → categorizing → embedding → storing → completed
```

### PDF Extraction: Vision-First (visionExtractor.js + documentProcessor.js)
- **All PDFs use GPT-4.1-mini vision** — pages converted to PNG images via `pdf-to-img` v5, each page sent to vision API for **interpretation** (not transcription)
- Vision model **interprets** content into natural language: tables → sentences, charts → descriptions, preserving exact figures. Uses `[SECTION: Title]` markers instead of markdown headings
- `pdf-parse` retained only for metadata (title, author, page count) — NOT used for content extraction
- `pdf-to-img` v5 uses `pdf()` named export (not `convert` from v4), has built-in renderer (no `canvas` native dep needed)
- Falls back to pdf-parse text only if vision extraction returns empty
- Env vars: `OPENAI_VISION_MODEL` (default gpt-4.1-mini), `VISION_CONCURRENCY` (default 3), `VISION_MAX_PAGES` (default 50)

### Chunking Quality Pipeline (documentProcessor.js)
- **`cleanTitle(rawTitle)`** (exported) — strips `[SECTION:]` markers, `#` prefixes, `**` bold, leading numbers. Used by documentWorker and openai.js
- **`cleanText(text)`** — strips markdown heading prefixes, bold/italic, horizontal rules, converts markdown table rows to comma-separated text, collapses blank lines. Applied to section content bodies after heading detection
- **`detectSections(text)`** — two-strategy approach: Strategy A detects `[SECTION: Title]` markers from vision output (preferred when 2+ found); Strategy B uses fallback regex (ALL-CAPS, numbered headings, Section/Chapter keywords, markdown `#`) for legacy content. Over-broad sentence-matching pattern removed
- **`structureAwareChunk(text, title)`** — heading/content separated (no duplication), preamble before first section captured, `cleanText()` applied per-section, min-content filter (< 50 chars skipped), consecutive duplicate-heading merge (short chunks combined)
- **`splitLargeSection(contentBody, heading)`** — accepts pre-stripped content body, returns `{content, heading}` objects (heading NOT embedded in content)
- **Embedding text** = `cleanTitle(heading) + \n\n + content` with double-heading safety check

### BullMQ Queue Tuning (jobQueue.js + documentWorker.js)
- `attempts: 1` — no retries (uploaded file is deleted after first attempt; retries cause ENOENT)
- `BATCH_SIZE: 25` — reduced from 100 to avoid Supabase statement timeout on large embedding inserts

### Step-Level Progress
Worker emits structured progress: `{ percent, step, detail }` — polled by frontend every 2s with exponential backoff (max 10s). Steps: extracting (15%) → chunking (35%) → categorizing (45%) → embedding (55%) → storing (75–90%) → completed (100%).

### Database: document_uploads table
Columns added 2026-03-23: `file_hash TEXT`, `subcategory VARCHAR(100)`.
Migration: `backend/migrations/add_document_uploads_file_hash.sql`

### API Endpoints (documents.js)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/documents/upload` | Single file upload |
| POST | `/api/admin/documents/upload-bulk` | Up to 10 files |
| GET | `/api/admin/documents` | List documents |
| GET | `/api/admin/documents/:id/status` | Poll status (returns jobStep, jobDetail) |
| PATCH | `/api/admin/documents/:id/metadata` | Update category/subcategory (updates doc + all chunks) |
| DELETE | `/api/admin/documents/:id` | Delete doc + all chunks |
| GET | `/api/admin/documents/:id/chunks` | View knowledge base chunks |

## Chat Pipeline Architecture

### Intent-Aware Routing (chat.js)

Messages are classified using a 2-tier system: fast regex for obvious greetings/acks, then gpt-4o-mini LLM fallback for ambiguous messages (~$0.00015/call, ~200ms latency).

```
User Message
     ↓
classifyMessageIntentFastPath() → greeting | conversational | unknown
     ↓ (if unknown)
classifyMessageIntentLLM() → domain_question | correction | contact_info | meta_request | follow_up
     ↓
greeting/conversational/correction/contact_info → skip KB search, confidence=0.9, no escalation
     ↓
domain_question/follow_up/meta_request → KB search → RAG → 2-attempt escalation flow
```

**Intent categories**:
| Intent | KB Search? | Can Escalate? | Example |
|--------|-----------|--------------|---------|
| `greeting` | No | No | "hi", "hello" |
| `conversational` | No | No | "ok", "thanks", "bye" |
| `domain_question` | Yes | Yes (after 2nd attempt) | "what's my dental coverage?" |
| `correction` | No | No | "ignore the wrong email", "I meant..." |
| `contact_info` | No | No | "sengwee.cbre.com", "88399967" |
| `meta_request` | Yes | Yes (after 2nd attempt) | "forgot username", "can't login" |
| `follow_up` | Yes | Yes (after 2nd attempt) | "what about dental?" after medical |

**AI-driven escalation (single-layer model — 2026-03-23)**: The AI prompt's `<escalation_and_state_management>` XML rules handle all escalation decisions (2-attempt flow: ask to elaborate first, then escalate). Backend only **detects** the AI's escalation phrases via substring matching and triggers side effects (DB record, Telegram notification). No backend confidence override — the AI is the single source of truth for when to escalate.

**Escalation detection** (`chat.js`): Normalized substring matching on AI response text (stripped markdown, collapsed whitespace). Checks for English phrases ("check back with the team", "leave your contact") and Chinese equivalents. Sets `awaitingContactInfo` state in Redis so next user message is treated as contact data.

**Contact info flow**: When `awaitingContactInfo` is true and user sends contact info (detected via regex + LLM intent), backend updates the existing escalation record with contact data and sends a follow-up Telegram notification — no new escalation created.

**Smart contact detection** (`escalationService.js`): Regex recognizes domain-style identifiers (e.g., `name.company.com`) in addition to emails and phone numbers. LLM intent also catches contact info contextually.

**`calculateConfidence()`** (`openai.js`): Simplified to purely informational (for caching/metadata). Non-KB intents return 0.9. KB intents: `0.4 + (avgSimilarity * 0.5)`. Not used for escalation decisions.

**Anti-hallucination (openai.js — 2026-03-01)**: When KB returns no results, the context section is replaced with an explicit `[NO KNOWLEDGE BASE DATA AVAILABLE FOR THIS QUERY]` marker. System prompt instruction #3 explicitly forbids answering benefits/coverage/policy questions from GPT training knowledge.

**Escalation guard**: `canEscalate && aiEscalated && ESCALATE_ON_NO_KNOWLEDGE` — only domain_question, follow_up, and meta_request intents can trigger escalation side effects.

**Similarity threshold** (`similarity_threshold`): Default `0.55`. This is the pgvector database-level filter that gates which KB entries reach the AI. Company-level override via `ai_settings.similarity_threshold`. This is NOT an escalation threshold — it controls KB retrieval quality.

**System prompt updates (openai.js — 2026-03-17)**: Instructions 3b (elaboration before escalation) and 3c (non-benefits message handling) added. Context awareness extended with correction handling and domain-style identifier recognition.

**System prompt management (2026-03-23)**: The AI system prompt is now **exclusively managed in the backend** (`createRAGPrompt()` in `openai.js`). The admin portal AI Settings page no longer has a prompt textarea — it only controls tuning parameters (model, temperature, similarity threshold, top K). Custom `system_prompt` values in `ai_settings` JSONB are ignored by the backend. The `injectVariablesIntoPrompt()` function was removed. This prevents frontend prompt overrides from silently dropping KB context, conversation history, or escalation logic.

### Query Cache + Semantic Cache (chat.js + session.js — 2026-03-09)

Full pipeline for `domain_question` intent:

```
domain_question detected
     ↓
Exact-match check: getCachedQueryResult(`query:{schemaName}:{hash}`)
     ↓ miss
generateEmbedding(query)          ← ONE call, shared below
     ↓
getSemanticCacheMatch(schemaName, embedding)  ← cosine similarity ≥ 0.95 → return cached
     ↓ miss
searchKnowledgeBase(..., precomputedEmbedding)  ← skips internal generateEmbedding()
     ↓
generateRAGResponse → setSemanticCache()  ← stores answer + embedding + updates index
```

**Redis key structure:**

| Key | Value | TTL |
|-----|-------|-----|
| `query:{schemaName}:{hash}` | `{answer, confidence, sources}` JSON | 3600s |
| `query:embed:{schemaName}:{hash}` | `float[]` embedding JSON | 3600s |
| `query:index:{schemaName}` | Redis SET of hashes (for SMEMBERS scan) | 3600s |

**Cache invalidation**: All KB write routes (create, batch, update, delete, Excel upload) call `invalidateCompanyQueryCache(schemaName)` fire-and-forget after success. Deletes all three key patterns via Redis SCAN.

**PDPA compliance**: Cache is namespaced per `schemaName` — CBRE and STM can ask identical questions without serving each other's cached answers.

## Email Automation (Super Admin Only)

Manages monthly panel listing reminder emails to insurance/health providers. Accessible via Admin Portal sidebar → **📧 Email Automation** (super admin only).

### Database Table (public schema)

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

### Scheduler

- Cron runs **every minute** (`* * * * *`) — lightweight Supabase query each tick
- Sends emails where: `is_active=true` AND (`scheduled_date=today` OR `recurring_day=todayDay`) AND `send_time=currentHH:MM (SGT)` AND NOT already sent today at or after the scheduled time
- **Duplicate send guard**: skips only if `last_sent_at` (converted to SGT) is same day AND time ≥ `send_time`. A manual "Send Now" before the scheduled time does NOT block the scheduled trigger.
- One Graph API client created per cron run (shared across all emails — single token request)
- Cron wrapped in try/catch — failures log but never crash the Express process

### Template Variables

`<<current month>>` / `<<Current Month>>` → e.g. "March" (case-insensitive)
`<<current year>>` / `<<Current Year>>` → e.g. "2026"

Email body sent as: `Dear [recipientName],<br><br>[resolved body with \n → <br>]`

### Excel Import

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

### API Endpoints

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

## Common Issues & Fixes

### Employee upload fails for new company
Schema not exposed to PostgREST. Check `pgrst_config.db_schemas` table includes the new schema. Should be automatic — if not, check Azure Web App logs for `[SchemaAutomation] Could not update PostgREST in-database config` warning.

### Chatbot not appearing on client site
1. **SRI hash mismatch**: Check Azure logs for `[SRI] MISMATCH` errors. Fix: rebuild widget (`npm run build-widget`) or wait 60s for TTL cache to refresh after deploy.
2. **Domain mismatch**: Verify `domain` param in embed URL, check company's registered domain.

### Mobile input area cut off
Add `paddingBottom: env(safe-area-inset-bottom)` to input container.

### Iframe not going fullscreen on mobile
Update `embed-helper.js` — ensure `top: 0; left: 0; right: 0; bottom: 0` all set.

### Chat button icon clipped
Ensure closed state iframe dimensions include padding (300x88px).

### Large gap at bottom of widget
Check height calculation — button is hidden when open, use `contentHeight + 8` not `+ 80`.

### File download not working from widget (LOG form PDF)
**Cause:** The widget runs inside a sandboxed cross-origin iframe. Browsers block all download mechanisms (`fetch+blob`, `window.open`, `<a download>`) from sandboxed iframes unless `allow-downloads` is in the sandbox attribute. Even if `allow-downloads` is added at runtime via `embed-helper.js`, it only applies to future navigations — the already-loaded widget content retains the original sandbox permissions.

**Fix:** Downloads must be delegated to the parent page via `postMessage`. The widget sends `{ type: 'chatWidgetDownload', url, filename }` and `embed-helper.js` (running in the unsandboxed parent) creates a hidden `<a>` element pointing to the download URL and clicks it. See LOG form PDF download section above.

**Rule:** Never attempt direct downloads from within the iframe. Always use the postMessage delegation pattern through `embed-helper.js`.

### Widget covers full page on Safari/Mac (fullscreen takeover)
**Cause:** Race condition — inside the 200px iframe, `window.innerWidth = 200` so widget sets `isMobile = true`. If user opens widget before `chatWidgetParentInfo` message arrives from parent, widget sends `width: '100vw', height: '100vh'` (string). Safari is more affected because cross-origin postMessage delivery is slower than Chrome.

**Fix (already applied in `embed-helper.js`):** Desktop path only applies **numeric pixel dimensions**. String values like `'100vw'`/`'100vh'` are ignored — once the parent sends `chatWidgetParentInfo` a few ms later, `isMobile` corrects to `false` and the widget resends proper pixel values.

**Rule:** `embed-helper.js` desktop branch must use `if (typeof w === 'number')` guards. Never apply viewport-unit strings on the desktop path. Mobile fullscreen is handled by the `isFullscreen=true` branch which runs first anyway.

## Client Communication

**Clients do NOT need to update their code for:** Bug fixes, UI improvements, mobile optimizations, new features (without new parameters).

**Clients NEED to update their code for:** API URL changes, new required parameters, breaking changes to iframe ID.

**Inspro vendor needs to re-paste the Dynamic snippet** when a new company is onboarded. Generate the updated snippet from Admin Portal → `</> Embed Codes` → Dynamic tab — it already includes all companies with real UUIDs. The same snippet is pasted on both production and staging (no separate versions needed).
