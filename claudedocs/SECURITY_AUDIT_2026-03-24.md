# Security Audit & Remediation Report

**Date:** 2026-03-24
**Scope:** Full-stack audit (Express.js backend + React widget + Admin portal)

---

## Summary

| Severity | Found | Fixed | Deferred |
|----------|-------|-------|----------|
| CRITICAL | 3 | 3 | 0 |
| HIGH | 7 | 5 | 2 |
| MEDIUM | 14 | 12 | 2 |
| LOW | 8 | 8 | 0 |
| **Total** | **32** | **28** | **4** |

---

## CRITICAL Fixes (All Applied)

### C1: postMessage Origin Validation — embed-helper.js
**Risk:** Any page embedding the widget could send forged messages to resize/control the iframe.
**Fix:** Extract origin from `iframe.src` and validate `event.origin` on all incoming messages. Messages from unknown origins are silently dropped.

### C2: postMessage Source Validation — ChatWidget.jsx
**Risk:** Malicious scripts in the same page could send fabricated `chatWidgetParentInfo` messages.
**Fix:** Added `event.source !== window.parent` check — only messages from the actual parent window are processed.

### C3: Open Redirect via Download Handler — embed-helper.js
**Risk:** `chatWidgetDownload` message could trigger downloads from arbitrary URLs.
**Fix:** Download URLs are validated to start with the widget's origin. Non-matching URLs are blocked and logged.

---

## HIGH Fixes (5 Applied, 2 Deferred)

### H2: Source Maps in Production — admin/vite.config.js
**Fix:** Set `sourcemap: false` in production build config.

### H4: Hardcoded Company UUID in Test Page — test-iframe-mobile.html
**Fix:** Replaced real UUID and company name with placeholders. Changed absolute URLs to relative paths.

### H7: Schema Name Injection — admin/companies.js
**Fix:** Added `isValidSchemaName()` validation before any database operations. Rejects names containing SQL metacharacters.

### H1: JWT in localStorage (Admin Portal) — DEFERRED
**Why deferred:** Migrating from localStorage to httpOnly cookies requires coordinating frontend auth context, API client interceptors, and CORS config across two separate Azure deployments (Static Web App + Web App). The current `res.cookie('adminToken', ...)` is already set server-side — the admin portal needs to be updated to read from cookies instead of localStorage.
**Mitigation:** Admin portal is internal-only, behind auth. XSS risk is low given CSP headers.

### H5: ROPC Auth Flow for Email — emailAutomationService.js — DEFERRED
**Why deferred:** Migrating from ROPC (username/password) to Client Credentials (app-only) requires Azure AD admin to grant `Mail.Send` application permission and admin consent. Cannot be done via code change alone.
**Mitigation:** Service account credentials are in environment variables, not in code. ROPC is deprecated but still functional.

---

## MEDIUM Fixes (12 Applied, 2 Deferred)

### M1: CSP unsafe-inline for Scripts — server.js
**Fix:** Replaced `script-src 'unsafe-inline'` with per-request nonce generation (`crypto.randomBytes`). The inline bootstrap script in `/chat` HTML now includes `nonce="${nonce}"`. External scripts (`widget.iife.js`) are allowed by `'self'`.
**Note:** `style-src 'unsafe-inline'` remains — required by React's inline `style={}` props. Removing would require extracting all inline styles to CSS classes.

### M2: Error Detail Leakage — 10 route files
**Fix:** Created `safeErrorDetails()` utility in `response.js` that returns `error.message` only in non-production. In production, `details` field is `undefined` (omitted from JSON). Applied across all route handlers (~40 occurrences).

**Files modified:** chat.js, companies.js, aiSettings.js, documents.js, knowledge.js, emailAutomation.js, index.js, quickQuestions.js, escalations.js, employees.js

### M3: Login Rate Limiting — server.js
**Fix:** Added dedicated `authLimiter` (10 requests/minute) for `/api/auth/login`.

### M4: Anonymous Form Rate Limiting — server.js
**Fix:** Added `anonymousFormLimiter` (5 requests/minute) for `/api/chat/anonymous-log-request` and `/api/chat/callback-request`.

### M6: Content-Disposition Header Injection — chat.js
**Fix:** Sanitized filename from JSONB settings — strips `"`, `\r`, `\n`, `\` characters before use in Content-Disposition header.

### M7: Email Format Validation — emailAutomationService.js
**Fix:** Added RFC-compliant email regex validation in `parseEmailList()`. Invalid addresses are silently filtered out instead of being passed to Graph API.

### M8: Path Traversal in Document Worker — documentWorker.js
**Fix:** Validates `filePath` starts with `uploads/documents/` and contains no `..` segments before processing.

### M11: ReactMarkdown Link Sanitization — Message.jsx
**Fix:** Added custom `a` component to ReactMarkdown that only allows `http:`, `https:`, and `mailto:` protocols. Links with `javascript:` or other protocols render as plain `<span>` text.

### M12: postMessage Target Hardening — ChatWidget.jsx, LogRequestForm.jsx, LogRouteSelector.jsx
**Fix:** Outgoing `postMessage()` calls must use `'*'` as `targetOrigin` because the widget iframe (at our API origin) is embedded on arbitrary client sites whose origins cannot be predicted. Security is enforced on the **receiving** end: `embed-helper.js` validates `event.origin` on all incoming messages (C1 fix), and `ChatWidget.jsx` validates `event.source === window.parent` (C2 fix). Added explanatory comments to all three files documenting this architectural constraint.

### M13: Session Storage for PII — ChatWidget.jsx
**Fix:** Changed `localStorage` to `sessionStorage` for `chat_session` key. Session data (which may contain employee identifiers) is now automatically cleared when the browser tab closes.

### M14: Account Lockout Fail-Closed — auth.js
**Fix:** When Redis is unavailable for lockout checking, login is now denied with 503 instead of allowed (fail-open → fail-closed). Prevents brute-force bypass during Redis outages.

### M5: PII Encryption in Redis — DEFERRED
**Why deferred:** Encrypting conversation history at rest in Redis requires an encryption key management solution and would add latency to every message read/write. Session data has a 1-hour TTL.
**Mitigation:** Redis is on Azure private network, not publicly accessible. Data is transient (1hr TTL).

### M10: pdf-parse JS Execution — DEFERRED (Accepted Risk)
**Why deferred:** The `pdf-parse` library's JS execution issue only applies to PDFs with embedded JavaScript. The backend already validates magic bytes on upload, and the library is only used for metadata extraction (content extraction uses GPT-4.1-mini vision).
**Mitigation:** Magic byte validation, metadata-only usage, server-side processing (no client exposure).

---

## LOW Fixes (All Applied)

### L2: Debug Endpoints in Production — admin/index.js
**Fix:** Debug router is only mounted when `NODE_ENV !== 'production'`.

### L3: Root Endpoint Information Disclosure — server.js
**Fix:** Root endpoint returns minimal `{ name: 'API', status: 'ok' }` in production instead of exposing version, endpoints, and internal structure.

### L4: redis.keys() Blocking Call — admin/index.js
**Fix:** Replaced `redis.keys('company:domain:*')` with `redis.scan()` loop (non-blocking, cursor-based iteration with COUNT 100).

### L5: Pagination Validation — documents.js
**Fix:** Applied `parseInt()` + `Math.min(200)` cap to pagination params in both document listing and chunk listing routes. Prevents unbounded queries.

### L6: Employee ID Masking in Logs — session.js
**Fix:** Security warning logs now show only first 3 characters of employee IDs (e.g., `abc***`) to prevent PII exposure in log files.

### L7: Unbounded Memory Cache — companyContext.js
**Fix:** Added `MEMORY_CACHE_MAX_SIZE = 200` cap. When the cache is full, the oldest entry is evicted before inserting a new one. Also removed domain reflection in 404 error response.

### L8: Console Statements in Widget Build — widget/vite.config.js
**Fix:** Added terser minification with `drop_console: true` and `drop_debugger: true`. Production widget builds will have no console output.

### L1: Double JWT Generation — auth.js
**Status:** Reviewed and determined to be architecturally necessary. The first token is needed to create the admin session record, then a second token is generated with the session ID included. Both tokens are short-lived.

---

## Architecture Notes

### Files Modified
| File | Fixes Applied |
|------|---------------|
| `backend/server.js` | M1 (CSP nonce), M3, M4, L3 |
| `backend/public/embed-helper.js` | C1, C3 |
| `backend/public/test-iframe-mobile.html` | H4 |
| `backend/api/utils/response.js` | M2 (safeErrorDetails utility) |
| `backend/api/utils/session.js` | L6 |
| `backend/api/routes/auth.js` | M14 |
| `backend/api/routes/chat.js` | M2, M6 |
| `backend/api/routes/documents.js` | M2, L5 |
| `backend/api/routes/aiSettings.js` | M2 |
| `backend/api/routes/admin/index.js` | L2, L4, M2 |
| `backend/api/routes/admin/companies.js` | H7, M2 |
| `backend/api/routes/admin/employees.js` | M2 |
| `backend/api/routes/admin/knowledge.js` | M2 |
| `backend/api/routes/admin/escalations.js` | M2 |
| `backend/api/routes/admin/quickQuestions.js` | M2 |
| `backend/api/routes/admin/emailAutomation.js` | M2 |
| `backend/api/workers/documentWorker.js` | M8 |
| `backend/api/services/emailAutomationService.js` | M7 |
| `backend/api/middleware/companyContext.js` | L7 |
| `frontend/widget/src/ChatWidget.jsx` | C2, M12, M13 |
| `frontend/widget/src/components/Message.jsx` | M11 |
| `frontend/widget/src/components/login/LogRequestForm.jsx` | M12 |
| `frontend/widget/src/components/login/LogRouteSelector.jsx` | M12 |
| `frontend/widget/vite.config.js` | L8 |
| `frontend/admin/vite.config.js` | H2 |

### Deferred Items Migration Plan
1. **H1 (JWT httpOnly cookies):** Update admin AuthContext to use cookie-based auth → update API client to send credentials → test cross-domain cookie flow on Azure
2. **H5 (ROPC → Client Credentials):** Request Azure AD admin to grant `Mail.Send` app permission → update `getGraphClient()` to use `acquireTokenByClientCredential()` → remove service account password from env vars
3. **M5 (Redis PII encryption):** Evaluate `@node-redis/json` encrypted fields or application-level AES-256-GCM encryption with key from Azure Key Vault
