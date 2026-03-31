# AI Chatbot Project - Claude Code Instructions

## Project Overview

This is a multi-tenant AI chatbot widget embedded via iframe on client websites (e.g., Inspro, CBRE). Each tenant gets a schema-isolated Supabase database with vector search (pgvector) for RAG-powered responses.

**Stack:** Express.js backend (Azure Web App) | React + Zustand widget (IIFE bundle) | React admin portal (Azure Static Web Apps) | Supabase (PostgreSQL + pgvector) | Redis (Azure) + BullMQ | OpenAI

## Backend Architecture

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
- **X-Frame-Options**: `DENY` on all routes except `/chat` (iframe embed) and `/api/chat/log-form/*`
- **LOG upload validation**: Frontend + backend token-overlap matching blocks non-LOG documents (`logAttachmentValidation.js`)

## Widget Deployment

Clients use an **iframe embed** approach. Widget files are hosted on Azure — any update we push applies to all client sites automatically.

### Client Embed Code

Get from **Admin Portal → Company Management → `</> Embed Codes` button** (top-right of page).

#### Dynamic (SPA / multi-company hosts)
For sites where multiple companies share the same host (e.g. Inspro vendor portal). Uses `window.location.hostname` at runtime — **one snippet works on both production and staging**. `companyMap` is auto-generated with real UUIDs and paths from all registered companies.

#### Static (standalone pages)
For sites with one company per page. Hardcoded company ID and domain. One snippet per company per domain.

### Embed Code UI (`EmbedCodeModal.jsx`)

- **Single global button** (`</> Embed Codes`) in Company Management header — not per-row
- **Dynamic tab**: groups companies by shared hosts using union-find. Only SPA companies (path-based domains) appear here.
- **Static tab**: one card per company, one code block per domain (primary = Production, additional = Staging)
- `VITE_API_URL` env var sets the API base URL in generated snippets

### How to Update the Widget

```bash
cd backend && npm run build-widget    # Build + copy + regenerate SRI hashes
```

Widget is also built automatically in CI/CD on every push to `main` touching `backend/**` or `frontend/widget/**`.

## Iframe Dynamic Resize

Widget sends `chatWidgetResize` postMessage → `embed-helper.js` in the parent resizes the iframe.

**Size states:**
| State | Width | Height |
|-------|-------|--------|
| Closed (button + tooltip) | 300px | 88px |
| Open - Teaser | 380px | ~280px |
| Open - Form | 380px | up to 850px |
| Mobile Open | 100vw | 100dvh |

**PostMessage types handled by `embed-helper.js`:**
| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `chatWidgetResize` | Widget → Parent | Resize iframe to fit widget content |
| `chatWidgetDownload` | Widget → Parent | Delegate file download (iframe sandbox blocks direct downloads) |
| `chatWidgetParentInfo` | Parent → Widget | Send parent viewport width + isMobile flag |

**Safari fix (applied 2026-03-25):** Widget sends `chatWidgetReady` on mount → `embed-helper.js` responds immediately with `chatWidgetParentInfo`. Fallback timeouts at 100ms / 500ms / 1500ms. Do not remove this handshake.

**Rules:**
- `embed-helper.js` desktop branch uses `if (typeof w === 'number')` guards — never apply viewport-unit strings
- Downloads must always be delegated via postMessage using `<a>` navigation (not `fetch+blob`) to avoid parent CSP `connect-src` restrictions

## Multi-Tenant Domain Routing

Detection order: `domain` URL param → `document.referrer` → `window.location.hostname`

For multi-tenant sites with paths (e.g., `benefits-staging.inspro.com.sg/cbre`), the `domain` param is required because cross-origin referrers strip the path.

`normalizeDomain()` in `companySchema.js` removes protocol, `www.`, trailing slash, and preserves path.

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

Both `benefits.inspro.com.sg` and `benefits-staging.inspro.com.sg` are **SPAs** — use the **Dynamic** snippet from Admin Portal → Embed Codes.

- Primary Domain → production path (e.g., `benefits.inspro.com.sg/cbre`)
- Additional Domains → staging path (e.g., `benefits-staging.inspro.com.sg/cbre`)

**Adding a new company:** Register in Admin Portal → open Embed Codes modal → copy updated Dynamic snippet → send to vendor (single re-paste on each environment).

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

Per-company email settings stored as **top-level columns** on the `companies` table. Managed via Admin Portal → Company Management → 📧 button.

| Column | Purpose |
|--------|---------|
| `log_request_email_to` | TO recipients for LOG request notifications (required) |
| `log_request_email_cc` | CC recipients for LOG request notifications (optional) |
| `log_request_keywords` | Keywords that trigger a LOG email (array) |
| `callback_email_to` | TO recipients for callback notifications (optional, falls back to `log_request_email_to`) |
| `callback_email_cc` | CC recipients for callback notifications (optional, falls back to `log_request_email_cc`) |

**Callback email fallback**: if `callback_email_to` is null, falls back to `log_request_email_to`. LOG email is the minimum required config for both flows.

**Email sending**: Microsoft Graph API (ROPC flow) via `email.js`. Requires `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_SERVICE_ACCOUNT_USERNAME`, `AZURE_SERVICE_ACCOUNT_PASSWORD`, `LOG_REQUEST_EMAIL_FROM`.

## Company Widget Feature Flags

Per-company toggles in `company.settings` JSONB. Admin Portal → Company Management → Edit → **Widget Options**.

| Setting key | Default | Effect |
|-------------|---------|--------|
| `showChat` | `true` | Shows "Send us a message" option |
| `showLog` | `true` | Shows "Request Letter of Guarantee" option |
| `telegramEscalation` | `true` | Sends escalation notifications to Telegram |

- Both disabled → OptionSelector not rendered
- Only one enabled → auto-selects that option, skips OptionSelector
- Network error on `/config` → defaults to both enabled
- `telegramEscalation=false` → escalation DB record still created, Telegram skipped. LOG request Telegram notifications unaffected.

## Reference Documentation

@docs/CHAT_PIPELINE.md
@docs/DOCUMENT_PIPELINE.md
@docs/EMAIL_AUTOMATION.md
@docs/LOG_CONFIG.md
@docs/INFRASTRUCTURE.md

## Common Issues & Fixes

### Employee upload fails for new company
Schema not exposed to PostgREST. Check `pgrst_config.db_schemas` table includes the new schema. Should be automatic — if not, check Azure Web App logs for `[SchemaAutomation] Could not update PostgREST in-database config` warning.

### Chatbot not appearing on client site
1. **SRI hash mismatch**: Check Azure logs for `[SRI] MISMATCH` errors. Fix: rebuild widget (`npm run build-widget`) or wait 60s for TTL cache to refresh.
2. **Domain mismatch**: Verify `domain` param in embed URL, check company's registered domain.

### File download not working from widget (LOG form PDF)
Downloads must be delegated via postMessage. Widget sends `{ type: 'chatWidgetDownload', url, filename }` → `embed-helper.js` creates a hidden `<a>` and clicks it. See `docs/LOG_CONFIG.md` for full rationale.

### Widget opens but shows only top portion on Safari
Race condition — widget loads inside a 200px iframe before parent info arrives. Fixed by `chatWidgetReady` handshake (2026-03-25). See Iframe Dynamic Resize section.

## Client Communication

**Clients do NOT need to update their code for:** Bug fixes, UI improvements, mobile optimizations, new features (without new parameters).

**Clients NEED to update their code for:** API URL changes, new required parameters, breaking changes to iframe ID.

**Inspro vendor needs to re-paste the Dynamic snippet** when a new company is onboarded. Generate from Admin Portal → `</> Embed Codes` → Dynamic tab. Same snippet for both production and staging.
