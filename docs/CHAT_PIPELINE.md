# Chat Pipeline Architecture

## Intent-Aware Routing (chat.js)

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

## AI-Driven Escalation

**Single-layer model (2026-03-30)**: The AI prompt's `<escalation_and_state_management>` XML rules handle all escalation decisions (2-attempt flow: ask to elaborate first, then escalate). Backend tracks `failedKBAttempts` in Redis session state — incremented when KB search returns empty for a `domain_question`, passed into the system prompt so the AI knows the attempt count. Backend only **detects** the AI's escalation phrases via substring matching and triggers side effects (DB record, Telegram notification). No backend confidence override — the AI is the single source of truth for when to escalate.

**Escalation message template** (`openai.js`): English-only — `"For such a query, let us check back with the team. You may leave your contact or email address for our team to follow up with you. Thank you."` The AI translates based on the user's language. No hardcoded Chinese template (removed 2026-03-31 to fix erroneous Chinese responses to English users).

**Escalation detection** (`chat.js`): Normalized substring matching on AI response text (stripped markdown, collapsed whitespace). Checks for English phrases ("check back with the team", "leave your contact", "our team to follow up") and Chinese substrings (`核实`, `留下您的联系`) for Chinese-speaking users. Sets `awaitingContactInfo` state in Redis so next user message is treated as contact data.

**Contact info flow**: When `awaitingContactInfo` is true and user sends contact info (detected via regex + LLM intent), backend updates the existing escalation record with contact data and sends a follow-up Telegram notification — no new escalation created.

**Contact info misclassification guard** (chat.js — 2026-03-30): If LLM classifies as `contact_info` but all three conditions are false (`awaitingContactInfo`, `wasEscalation`, `isContactInformation()` regex), reclassifies to `meta_request`. Prevents messages like "how to change my contact number" from being treated as raw contact data.

**Smart contact detection** (`escalationService.js`): Regex recognizes domain-style identifiers (e.g., `name.company.com`) in addition to emails and phone numbers.

**Escalation guard**: `canEscalate && aiEscalated && ESCALATE_ON_NO_KNOWLEDGE` — only domain_question, follow_up, and meta_request intents can trigger escalation side effects.

## System Prompt Management

The AI system prompt is **exclusively managed in the backend** (`createRAGPrompt()` in `openai.js`). The admin portal AI Settings page only controls tuning parameters (model, temperature, similarity threshold, top K). Custom `system_prompt` values in `ai_settings` JSONB are ignored.

**Anti-hallucination (2026-03-30)**: When KB returns no results, context is replaced with `[NO KNOWLEDGE BASE DATA AVAILABLE FOR THIS QUERY]`. Rule #4 (RELEVANCE JUDGMENT) treats irrelevant KB results as empty. Rule #5 (PORTAL REFERRAL) guides users to their employee benefits portal for plan-specific details.

**Similarity threshold** (`similarity_threshold`): Default `0.55`. pgvector database-level filter — controls KB retrieval quality, NOT escalation threshold. Company-level override via `ai_settings.similarity_threshold`.

**`calculateConfidence()`**: Purely informational. Non-KB intents return 0.9. KB intents: `0.4 + (avgSimilarity * 0.5)`. Not used for escalation decisions.

## Query Cache + Semantic Cache (chat.js + session.js — 2026-03-09)

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
