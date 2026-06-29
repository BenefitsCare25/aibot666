# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant AI chatbot widget embedded via iframe on client websites (e.g., Inspro, CBRE). Each tenant gets a schema-isolated Supabase PostgreSQL database with pgvector for RAG-powered responses.

**Stack:** Express.js backend (Azure Web App) | React + Zustand widget (IIFE bundle) | React admin portal (Azure Static Web Apps) | Supabase (PostgreSQL + pgvector) | Redis (Azure) + BullMQ | OpenAI

## Monorepo Structure

```
aibot/
  backend/          # Express.js API + widget static host
    api/
      handlers/     # chatMessageHandler.js — core chat pipeline
      middleware/   # authMiddleware.js, companyContext.js
      routes/       # chat.js, auth.js, documents.js, admin/
      services/     # openai.js, escalationService.js, qualityAnalyticsService.js, ...
      utils/        # session.js (Redis), sanitize.js, logAttachmentValidation.js
      workers/      # documentWorker.js (BullMQ)
    config/         # supabase.js, redis.js, company-schema-template.sql
    public/         # widget.iife.js, widget.css, sri-hashes.json (generated)
    scripts/        # build-widget.js, generate-sri.js
  frontend/
    admin/          # React admin portal (Vite + Tailwind + React Router v6)
    widget/         # React chat widget (Vite IIFE build)
  docs/             # CHAT_PIPELINE.md, DOCUMENT_PIPELINE.md, EMAIL_AUTOMATION.md, LOG_CONFIG.md, INFRASTRUCTURE.md
```

## Commands

### Backend
```bash
cd backend
npm run dev           # Start with nodemon (hot reload)
npm start             # Production start
npm run build-widget  # Build widget + copy to backend/public + regenerate SRI hashes
npm run generate-sri  # Regenerate SRI hashes only (after manual widget copy)
```

### Admin portal
```bash
cd frontend/admin
npm run dev           # Vite dev server
npm run build         # Production build
```

### Widget
```bash
cd frontend/widget
npm run dev           # Vite dev server (for widget UI development only)
npm run build         # Build IIFE bundle to dist/
npm run deploy        # build + copy to backend/public + generate SRI (same as build-widget from backend)
```

### After any widget change
Always run `npm run build-widget` from `backend/` — this is what CI/CD does. Do not manually copy files without regenerating SRI hashes or the widget will fail to load on clients (SRI mismatch).

## Architecture

### Multi-Tenant Isolation

Every company gets its own **PostgreSQL schema** (e.g., `cbre`, `inspro_vendor`). Each schema contains: `employees`, `chat_history`, `escalations`, `knowledge_base`, `quick_questions`, `callbacks`, `log_requests`, `document_uploads`, `knowledge_chunks`.

`companyContextMiddleware` runs on all non-admin routes. It resolves the tenant from the request (body `domain` → `X-Widget-Domain` header → Origin → Referer → Host), looks up the company in a two-layer cache (in-memory 60s → Redis 5min), then attaches `req.supabase` scoped to that schema. All subsequent service calls use `req.supabase` — never the default public client.

Routes that use the **public schema** (not tenant-scoped): `/companies` (adminContextMiddleware), `/email-automation` (direct public client).

### Chat Pipeline (`api/handlers/chatMessageHandler.js`)

```
Request
  → exact cache hit (Redis hash of query+schema) → return
  → classify intent (regex fast-path → gpt-4o-mini LLM)
  → semantic cache hit (cosine sim ≥ 0.95 on precomputed embedding) → return
  → KB search (pgvector, threshold from company ai_settings, default 0.55)
  → generateRAGResponse (OpenAI GPT-4)
  → persist to chat_history (metadata: latency_ms, tokens, best_similarity, action, intent)
  → escalation side-effects if AI output matches escalation phrases
  → cache response (exact + semantic)
```

Intent categories: `greeting`/`conversational`/`correction`/`contact_info` → skip KB search. `domain_question`/`follow_up`/`meta_request` → full KB+RAG path, can escalate.

### System Prompt

Managed exclusively in `backend/api/services/openai.js` → `createRAGPrompt()`. The Admin Portal AI Settings page controls only tuning parameters (model, temperature, similarity threshold, top-K). Any `system_prompt` value in the `ai_settings` JSONB column is ignored.

### Document Processing (`api/workers/documentWorker.js`)

BullMQ queue (5 concurrent workers). All PDFs go through GPT-4.1-mini vision (page→PNG→vision API) — not pdf-parse text extraction. Steps emit structured progress: `extracting (15%) → chunking (35%) → categorizing (45%) → embedding (55%) → storing (75-90%) → completed (100%)`.

`attempts: 1` — no retries. The uploaded file is deleted after the first attempt; retries would cause ENOENT.

### Widget Build & SRI

Widget is a Vite IIFE bundle (`widget.iife.js` + `widget.css`) served as static files from `backend/public/`. The backend computes SHA-384 hashes of these files into `public/sri-hashes.json` at build time. The `/chat` route reads this file (60s TTL cache) and injects hashes into the `<script>` tag. If the file on disk doesn't match the stored hash, the server logs `[SRI] MISMATCH`. CI/CD rebuilds the widget on every push touching `backend/**` or `frontend/widget/**`.

### Admin Auth vs Widget Auth

- **Admin portal**: JWT in `Authorization: Bearer` header. Issued on login, validated by `authenticateToken` middleware. Super-admin role gated by `requireSuperAdmin`.
- **Widget sessions**: Redis-backed session UUIDs (TTL 1h). Created at `/api/chat/session`. Employees identified by employee ID + company schema lookup. No JWT involved.

### Redis Key Namespaces

| Prefix | Purpose | TTL |
|--------|---------|-----|
| `session:{id}` | Widget session data | 1h |
| `conv:{id}` | conversationId → sessionId reverse lookup | 1h |
| `history:{convId}` | Conversation message list | 1h |
| `company:domain:{domain}` | Company lookup cache | 5min |
| `query:{schema}:{hash}` | Exact query cache | 1h |
| `query:embed:{schema}:{hash}` | Embedding for semantic cache | 1h |
| `query:index:{schema}` | SET of hashes for cache invalidation | 1h |
| `topic:{schema}:{hash}` | Cached reporting topic for a question | 7d |
| `ratelimit:{employeeId}` | Per-employee rate limit counter | 1min |
| `lockout:{employeeId}` | Account lockout after 5 failed logins | 15min |

### Quality Analytics (`api/services/qualityAnalyticsService.js`)

Reads `chat_history` and `escalations` tables. Key metrics:
- **Helpful rate**: `positiveCount / ratedCount` — only counts messages where users clicked 👍/👎. Zero if no ratings exist.
- **Avg response time**: average of `metadata.latency_ms` across assistant messages. Zero if field absent (pre-latency-tracking messages).
- **Similarity distribution**: bins `metadata.best_similarity` from KB search into `<0.55 / 0.55-0.69 / 0.70-0.84 / ≥0.85`.
- **Topic distribution / questions by topic**: counts of user-message `metadata.topic` plus the actual questions grouped under each topic (`topicDistribution` + `questionsByTopic`), classified into a fixed taxonomy (Coverage, Claims, Referral, Panel Clinics, Account/Login, LOG, Other — where Other is a genuine question that fits no other bucket). Tags are written asynchronously after each response by `topicClassifier.js` (`resolveQuestionTopic`, Redis-cached by query hash). Greetings/small talk/non-questions return null and are never tagged, so they are excluded from reporting entirely.

## Key Operational Rules

### Widget Changes
Always run `npm run build-widget` from `backend/` — never push widget JS/CSS without regenerating SRI hashes.

### Company Context
Never use the public `supabase` client inside tenant-scoped routes — always use `req.supabase`. The email-automation routes are the only exception (they explicitly use the public client for the `public.email_automations` table).

### KB Cache Invalidation
All KB write routes (create, update, delete, Excel upload) must call `invalidateCompanyQueryCache(schemaName)` fire-and-forget after success. Missing this causes stale answers to persist for up to 1 hour.

### LOG Attachment Validation
`validateLogAttachments()` logic exists in both `LoginForm.jsx` (widget) and `backend/api/utils/logAttachmentValidation.js`. Keep them in sync — the algorithm uses token-overlap matching plus a blocklist regex.

### Domain Resolution for Multi-Path SPAs
For tenants like Inspro where multiple companies share a host with path-based routing (e.g., `benefits.inspro.com.sg/cbre`), the `domain` URL parameter must be included in the embed snippet — cross-origin referrers strip the path. Use the Dynamic snippet from Admin Portal → Embed Codes.

## Security Features

- **JWT**: No hardcoded fallback — server throws on startup if `JWT_SECRET` unset
- **Account lockout**: 5 failed logins → 15min Redis lockout
- **File validation**: Magic bytes checked on upload (PDF, images, XLSX)
- **Query limits**: All pagination capped at 200
- **Debug endpoints**: Protected by `requireSuperAdmin` and disabled in production
- **Color param XSS**: Validated against `/^#[0-9a-fA-F]{3,8}$/`
- **X-Frame-Options**: `DENY` everywhere except `/chat` (iframe embed) and `/api/chat/log-form/*`
- **LOG dedup**: Anonymous LOG requests from the same email within 2 minutes return the existing record

## Environment Variables (Required)

- `JWT_SECRET` — server crashes on startup if unset
- `OPENAI_API_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- `SUPABASE_CONNECTION_STRING` (or `DATABASE_URL`) — direct PostgreSQL for DDL
- `REDIS_URL` — supports `rediss://` for TLS
- `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_SERVICE_ACCOUNT_USERNAME`, `AZURE_SERVICE_ACCOUNT_PASSWORD`, `LOG_REQUEST_EMAIL_FROM` — Microsoft Graph email
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — escalation notifications
- `NODE_ENV=production` — hides error details from clients

## Deployment

- **Backend**: Azure Web App (`app-aibot-api.azurewebsites.net`)
- **Admin portal**: Azure Static Web Apps (`gray-flower-0e68c8a00-preview.eastasia.6.azurestaticapps.net`)
- **GitHub account**: `BenefitsCare25` — switch with `gh auth switch --user BenefitsCare25`
- **Auto-deploy**: Push to `main` triggers GitHub Actions on changes to `backend/**` or `frontend/widget/**`
- **Deploy time**: ~4-5 min (build ~35s cached, Azure upload+restart ~4min)
- **Widget test page**: `https://app-aibot-api.azurewebsites.net/test-iframe-mobile.html`

## Infrastructure (Self-Hosted Supabase on Azure VM)

VM: `104.214.186.142` | Key: `C:\Users\huien\azurevm\supabase-vm_key.pem` | User: `azureuser`

PostgREST auto-exposes new schemas via in-database config (`pgrst_config.db_schemas` table + `NOTIFY pgrst, 'reload config'`). Manual restart only needed after VM reboot:
```bash
ssh -i "C:\Users\huien\azurevm\supabase-vm_key.pem" azureuser@104.214.186.142 "cd ~/supabase/docker && docker compose restart rest"
```

## Reference Docs

- `docs/CHAT_PIPELINE.md` — intent routing, escalation flow, caching pipeline detail
- `docs/DOCUMENT_PIPELINE.md` — vision extraction, chunking, BullMQ queue
- `docs/EMAIL_AUTOMATION.md` — scheduler, template vars, Excel import
- `docs/LOG_CONFIG.md` — per-company LOG routes, attachment validation, field validation
- `docs/INFRASTRUCTURE.md` — PostgREST schema automation, Docker log rotation
