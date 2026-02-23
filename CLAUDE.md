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
│   │   │   └── debug.js              # Diagnostics (requireSuperAdmin protected)
│   │   ├── chat.js                    # Chat session, messages, RAG flow, callbacks, /config endpoint
│   │   ├── auth.js                    # Login (with lockout), token refresh
│   │   ├── documents.js              # PDF upload, processing status
│   │   └── adminUsers.js             # Admin user management
│   ├── services/
│   │   ├── knowledgeService.js        # Knowledge base CRUD + vector search
│   │   ├── employeeService.js         # Employee CRUD + identifier lookup
│   │   ├── vectorDB.js               # Re-export shim (backward compat for both above)
│   │   ├── escalationService.js       # Escalation handling, contact detection
│   │   ├── callbackService.js         # Callback email + Telegram notifications
│   │   ├── companySchema.js           # Company lookup (indexed: exact → ilike → additional_domains)
│   │   ├── documentProcessor.js       # PDF extraction, chunking, embedding
│   │   ├── jobQueue.js               # BullMQ document processing queue
│   │   ├── telegram.js               # Telegram bot notifications
│   │   └── excel.js                  # Excel import/export
│   ├── utils/
│   │   ├── session.js                # Redis sessions (pipeline ops, conv: reverse lookup)
│   │   ├── redisClient.js            # ioredis singleton
│   │   ├── auth.js                   # JWT_SECRET (no fallback, throws if unset)
│   │   ├── sanitize.js               # Search param sanitization (SQL injection prevention)
│   │   ├── fileValidation.js          # Magic bytes validation (PDF, JPEG, PNG, GIF, XLSX)
│   │   ├── validation.js             # Shared EMAIL_REGEX, isValidEmail()
│   │   ├── pagination.js             # parsePagination(), paginationResponse() (cap: 200)
│   │   ├── quickQuestionUtils.js      # groupQuestionsByCategory()
│   │   └── response.js               # successResponse(), errorResponse()
│   └── workers/
│       └── documentWorker.js          # BullMQ worker for PDF processing
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

### Performance Features

- **Session lookup**: `conv:{conversationId}` reverse key instead of `redis.keys()` scan
- **Redis pipelines**: `touchSession` and `addMessageToHistory` batch commands
- **SRI hashes**: TTL cache (re-reads from disk every 60s) — survives deploys without restart. Startup validation logs `[SRI] MISMATCH` if hashes don't match files
- **Company lookup**: Indexed query (exact → ilike → additional_domains) instead of loading all
- **Schema client cache**: LRU bounded at 50 entries
- **Company cache**: Two-tier (in-memory 60s TTL → Redis) with periodic cleanup
- **Post-response ops**: `Promise.all` for DB save + session touch after OpenAI response
- **Employee lookup**: Single `.or()` query instead of 3 sequential queries

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
│   │   ├── LogRequestForm.jsx         # LOG request with file upload
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
    └── chatStore.js                   # Zustand state (crypto.randomUUID IDs, error state, companyFeatures)
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
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
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
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
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
│   ├── knowledge.js                   # Knowledge base + document upload API
│   └── quickQuestions.js              # Quick questions API
└── pages/
    ├── KnowledgeBase.jsx              # Knowledge base management
    ├── Employees.jsx                  # Employee management
    └── QuickQuestions.jsx             # Quick questions management
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
- **CI/CD pipeline**: Install widget deps → build widget + SRI hashes → install backend deps → deploy to Azure
- **GitHub account**: `BenefitsCare25` (switch with `gh auth switch --user BenefitsCare25`)

## Testing

- **Widget test page**: `https://app-aibot-api.azurewebsites.net/test-iframe-mobile.html`
- **Admin portal**: `https://gray-flower-0e68c8a00-preview.eastasia.6.azurestaticapps.net/`

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
5. Admin saves flags into the `settings` JSON — existing settings keys are preserved (merge, not replace)

**Edge cases:**
- Both disabled → OptionSelector not rendered (neither option shown)
- Only Chat enabled → auto-selects chat form, skips option screen
- Only LOG enabled → auto-selects LOG form, skips option screen
- Network error on `/config` → defaults to both enabled

## Common Issues & Fixes

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

## Client Communication

**Clients do NOT need to update their code for:** Bug fixes, UI improvements, mobile optimizations, new features (without new parameters).

**Clients NEED to update their code for:** API URL changes, new required parameters, breaking changes to iframe ID.

**Inspro vendor needs to re-paste the Dynamic snippet** when a new company is onboarded. Generate the updated snippet from Admin Portal → `</> Embed Codes` → Dynamic tab — it already includes all companies with real UUIDs. The same snippet is pasted on both production and staging (no separate versions needed).
