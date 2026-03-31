# Document Processing Pipeline (RAG Ingestion)

## Supported Formats
PDF, DOCX, TXT, CSV — max 25MB each, up to 10 files bulk upload.

## Processing Flow
```
Upload (single or bulk)
  ↓
SHA-256 hash check → 409 if duplicate
  ↓
BullMQ queue → documentWorker.js (5 concurrent workers)
  ↓
extracting → chunking → categorizing → embedding → storing → completed
```

## PDF Extraction: Vision-First (visionExtractor.js + documentProcessor.js)
- **All PDFs use GPT-4.1-mini vision** — pages converted to PNG images via `pdf-to-img` v5, each page sent to vision API for **interpretation** (not transcription)
- Vision model **interprets** content into natural language: tables → sentences, charts → descriptions, preserving exact figures. Uses `[SECTION: Title]` markers instead of markdown headings
- `pdf-parse` retained only for metadata (title, author, page count) — NOT used for content extraction
- `pdf-to-img` v5 uses `pdf()` named export (not `convert` from v4), has built-in renderer (no `canvas` native dep needed)
- Falls back to pdf-parse text only if vision extraction returns empty
- Env vars: `OPENAI_VISION_MODEL` (default gpt-4.1-mini), `VISION_CONCURRENCY` (default 3), `VISION_MAX_PAGES` (default 50)

## Chunking Quality Pipeline (documentProcessor.js)
- **`cleanTitle(rawTitle)`** (exported) — strips `[SECTION:]` markers, `#` prefixes, `**` bold, leading numbers. Used by documentWorker and openai.js
- **`cleanText(text)`** — strips markdown heading prefixes, bold/italic, horizontal rules, converts markdown table rows to comma-separated text, collapses blank lines. Applied to section content bodies after heading detection
- **`detectSections(text)`** — two-strategy approach: Strategy A detects `[SECTION: Title]` markers from vision output (preferred when 2+ found); Strategy B uses fallback regex (ALL-CAPS, numbered headings, Section/Chapter keywords, markdown `#`) for legacy content
- **`structureAwareChunk(text, title)`** — heading/content separated (no duplication), preamble before first section captured, `cleanText()` applied per-section, min-content filter (< 50 chars skipped), consecutive duplicate-heading merge (short chunks combined)
- **`splitLargeSection(contentBody, heading)`** — accepts pre-stripped content body, returns `{content, heading}` objects (heading NOT embedded in content)
- **Embedding text** = `cleanTitle(heading) + \n\n + content` with double-heading safety check

## BullMQ Queue Tuning (jobQueue.js + documentWorker.js)
- `attempts: 1` — no retries (uploaded file is deleted after first attempt; retries cause ENOENT)
- `BATCH_SIZE: 25` — reduced from 100 to avoid Supabase statement timeout on large embedding inserts

## Step-Level Progress
Worker emits structured progress: `{ percent, step, detail }` — polled by frontend every 2s with exponential backoff (max 10s). Steps: extracting (15%) → chunking (35%) → categorizing (45%) → embedding (55%) → storing (75–90%) → completed (100%).

## Database: document_uploads table
Columns added 2026-03-23: `file_hash TEXT`, `subcategory VARCHAR(100)`.
Migration: `backend/migrations/add_document_uploads_file_hash.sql`

## API Endpoints (documents.js)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/documents/upload` | Single file upload |
| POST | `/api/admin/documents/upload-bulk` | Up to 10 files |
| GET | `/api/admin/documents` | List documents |
| GET | `/api/admin/documents/:id/status` | Poll status (returns jobStep, jobDetail) |
| PATCH | `/api/admin/documents/:id/metadata` | Update category/subcategory (updates doc + all chunks) |
| DELETE | `/api/admin/documents/:id` | Delete doc + all chunks |
| GET | `/api/admin/documents/:id/chunks` | View knowledge base chunks |
