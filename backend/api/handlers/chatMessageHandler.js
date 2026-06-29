import OpenAI from 'openai';
import { createHash } from 'crypto';
import { generateEmbedding, generateRAGResponse } from '../services/openai.js';
import { searchKnowledgeBase } from '../services/vectorDB.js';
import {
  addMessageToHistory,
  checkRateLimit,
  getCachedQueryResult,
  getConversationHistory,
  getConversationState,
  getSemanticCacheMatch,
  getSession,
  setSemanticCache,
  touchSession,
  updateConversationState
} from '../utils/session.js';
import {
  getPendingEscalation,
  handleEscalation,
  isContactInformation,
  updateEscalationWithContact
} from '../services/escalationService.js';
import { resolveQuestionTopic } from '../services/topicClassifier.js';

const ESCALATE_ON_NO_KNOWLEDGE = process.env.ESCALATE_ON_NO_KNOWLEDGE !== 'false';
const classificationClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const KB_INTENTS = new Set(['domain_question', 'follow_up', 'meta_request']);
// Intents whose answer MUST be grounded in the knowledge base. meta_request is
// deliberately excluded: capability/about-the-service questions can be answered
// (or self-escalated) by the model and must not be force-clobbered.
const GROUNDED_INTENTS = new Set(['domain_question', 'follow_up']);
const ZERO_KB_CLARIFY_MESSAGE =
  "Could you provide more details about what you're looking for?";
const ZERO_KB_ESCALATION_MESSAGE =
  'For such a query, let us check back with the team. You may leave your contact or email address for our team to follow up with you. Thank you.';

export async function processChatMessage(req, res) {
  const startedAt = Date.now();
  try {
    const input = validateInput(req.body);
    if (input.error) return res.status(400).json(input.error);

    const session = await getSession(input.sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found or expired' });
    }

    const rateLimit = await checkRateLimit(session.employeeId, 100, 60);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        resetAt: rateLimit.resetAt
      });
    }

    const request = createRequestContext(req, session, input, startedAt);
    const exactCache = await getCachedQueryResult(request.cacheKey);
    if (exactCache) return sendCachedResponse(res, request, exactCache, 'exact');

    await loadEmployeeAndHistory(request);
    await classifyAndRetrieve(request);
    if (request.semanticCache) {
      return sendCachedResponse(res, request, request.semanticCache, 'semantic');
    }

    await applyPreResponseState(request);
    request.response = await generateRAGResponse(
      request.messageToProcess,
      request.contexts,
      request.employee,
      request.history,
      request.aiSettings,
      request.intent,
      request.failedKBAttempts
    );
    if (!request.needsKBSearch) request.response.confidence = 0.9;
    await enforceZeroKnowledgePolicy(request);

    await persistGeneratedResponse(request);
    await applyPostResponseAction(request);
    await cacheGeneratedResponse(request);
    return res.json({ success: true, data: responsePayload(request) });
  } catch (error) {
    console.error('Error processing message:', error);
    return res.status(500).json({ success: false, error: 'Failed to process message' });
  }
}

function validateInput(body) {
  const sessionId = body?.sessionId;
  const message = body?.message?.trim();
  if (!sessionId || !message) {
    return {
      error: {
        success: false,
        error: 'Session ID and message are required'
      }
    };
  }
  return { sessionId, message };
}

function createRequestContext(req, session, input, startedAt) {
  const queryHash = createHash('sha256').update(input.message.toLowerCase()).digest('hex');
  const schemaName = req.company.schemaName;
  return {
    req,
    session,
    sessionId: input.sessionId,
    message: input.message,
    messageToProcess: input.message,
    startedAt,
    schemaName,
    queryHash,
    cacheKey: `query:${schemaName}:${queryHash}`,
    aiSettings: req.company?.ai_settings || null,
    contexts: [],
    queryEmbedding: null,
    semanticCache: null
  };
}

async function loadEmployeeAndHistory(request) {
  const { data: employee, error } = await request.req.supabase
    .from('employees')
    .select('*')
    .eq('id', request.session.employeeId)
    .single();
  if (error || !employee) throw new Error('Failed to retrieve employee data');

  const history = await getConversationHistory(
    request.session.conversationId,
    40,
    request.session.employeeId
  );
  request.employee = employee;
  request.history = history.map(item => ({ role: item.role, content: item.content }));
  request.state = await getConversationState(request.sessionId) || {};
}

async function classifyAndRetrieve(request) {
  request.intent = classifyMessageIntentFastPath(request.message);
  if (request.intent === 'unknown') {
    try {
      request.intent = await classifyMessageIntentLLM(request.message, request.history);
    } catch (error) {
      console.error('LLM intent classification failed:', error.message);
      request.intent = 'domain_question';
    }
  }

  request.needsKBSearch = KB_INTENTS.has(request.intent);
  if (!request.needsKBSearch) return;

  request.queryEmbedding = await generateEmbedding(request.message);
  request.semanticCache = await getSemanticCacheMatch(
    request.schemaName,
    request.queryEmbedding
  );
  if (request.semanticCache) return;

  request.contexts = await searchKnowledgeBase(
    request.message,
    request.req.supabase,
    request.aiSettings?.top_k_results || 5,
    request.aiSettings?.similarity_threshold || 0.55,
    null,
    null,
    request.queryEmbedding
  );
}

async function applyPreResponseState(request) {
  const awaitingContact = request.state.awaitingContactInfo === true;
  const looksLikeContact = isContactInformation(request.message);

  if (request.intent === 'contact_info' && !awaitingContact && !looksLikeContact) {
    request.intent = 'meta_request';
    request.needsKBSearch = true;
  }

  if (request.intent === 'contact_info' || (awaitingContact && looksLikeContact)) {
    await handleContactResponse(request);
  } else if (request.intent === 'correction') {
    await updateConversationState(request.sessionId, {
      askedToElaborate: false,
      failedKBAttempts: 0,
      lastIntent: 'correction'
    });
  }

  request.failedKBAttempts = request.state.failedKBAttempts || 0;
  if (request.needsKBSearch && request.contexts.length === 0) {
    request.failedKBAttempts += 1;
    await updateConversationState(request.sessionId, {
      failedKBAttempts: request.failedKBAttempts,
      askedToElaborate: request.failedKBAttempts === 1,
      lastFailedQuery: request.message.substring(0, 200)
    });
  }
}

/**
 * Deterministic safety net for zero-knowledge answers.
 *
 * When a grounded-intent query (domain_question / follow_up) retrieves no
 * supporting context, the model has no source and tends to invent
 * plausible-but-ungrounded advice while self-reporting action "answer" — which
 * silently bypasses escalation. Enforce the documented policy regardless of what
 * the model returned: clarify once, then escalate on the next failed attempt
 * (mirrors the prompt's escalation rules and the failedKBAttempts threshold set
 * in applyPreResponseState). Fallback messages are localized to the user's
 * language to honor the same "respond in the user's language" rule as the prompt.
 */
async function enforceZeroKnowledgePolicy(request) {
  if (!GROUNDED_INTENTS.has(request.intent) || request.contexts.length > 0) return;

  const action = request.response.action;
  // Explicit escalations / contact acknowledgements are already correct.
  if (action === 'escalate' || action === 'contact_received') return;

  if (request.failedKBAttempts >= 2) {
    request.response.action = 'escalate';
    request.response.answer = await localizeFallback(ZERO_KB_ESCALATION_MESSAGE, request.message);
  } else if (action !== 'clarify') {
    request.response.action = 'clarify';
    request.response.answer = await localizeFallback(ZERO_KB_CLARIFY_MESSAGE, request.message);
  }
}

/**
 * Translate a canonical English fallback message into the user's language so the
 * deterministic safety net obeys the same language rule as the main prompt.
 * Plain-ASCII (English) input skips the round-trip; any failure degrades to the
 * English text so a translation outage never breaks the chat response.
 */
async function localizeFallback(message, userText) {
  if (![...userText].some(ch => ch.charCodeAt(0) > 127)) return message;
  try {
    const completion = await classificationClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content:
          `Translate the message into the same language as the user's text. ` +
          `Reply with ONLY the translated message, no quotes or notes.\n` +
          `User's text: "${userText.slice(0, 200)}"\n` +
          `Message: "${message}"`
      }],
      temperature: 0,
      max_tokens: 200
    });
    return completion.choices[0]?.message?.content?.trim() || message;
  } catch (error) {
    console.error('[ZeroKB] message localization failed, using English:', error.message);
    return message;
  }
}

async function handleContactResponse(request) {
  request.intent = 'contact_info';
  request.needsKBSearch = false;
  request.messageToProcess =
    `[User is providing contact information in response to escalation request] ${request.message}`;

  const pending = await getPendingEscalation(
    request.session.conversationId,
    request.req.supabase
  );
  if (pending) {
    const sendTelegram = request.req.company?.settings?.telegramEscalation !== false;
    await updateEscalationWithContact(
      pending.id,
      request.message,
      request.employee,
      request.req.supabase,
      { sendTelegram }
    );
  }

  await updateConversationState(request.sessionId, {
    awaitingContactInfo: false,
    lastBotAction: 'contact_received',
    contactReceivedAt: new Date().toISOString(),
    failedKBAttempts: 0,
    askedToElaborate: false
  });
}

async function persistGeneratedResponse(request) {
  request.escalated = KB_INTENTS.has(request.intent) &&
    request.response.action === 'escalate' &&
    ESCALATE_ON_NO_KNOWLEDGE;
  request.latencyMs = Date.now() - request.startedAt;

  await appendRedisHistory(
    request.session.conversationId,
    request.message,
    request.response
  );
  const ids = await persistExchange({
    supabaseClient: request.req.supabase,
    session: request.session,
    employeeId: request.employee.id,
    userMessage: request.message,
    response: request.response,
    metadata: buildResponseMetadata(request)
  });
  request.assistantMessageId = ids.assistantId;
  tagQuestionTopic(request, ids.userId);
}

async function applyPostResponseAction(request) {
  if (request.escalated) {
    await processEscalation(request);
  } else {
    await updateConversationState(request.sessionId, {
      lastBotAction: request.response.action,
      ...(request.contexts.length > 0 ? resetFailureState() : {})
    });
  }
  await touchSession(request.sessionId);
}

async function processEscalation(request) {
  await updateConversationState(request.sessionId, {
    ...resetFailureState(),
    consecutiveEscalations: (request.state.consecutiveEscalations || 0) + 1
  });
  const sendTelegram = request.req.company?.settings?.telegramEscalation !== false;
  await handleEscalation(
    request.session,
    request.message,
    request.response,
    request.employee,
    'ai_escalated',
    request.req.supabase,
    request.schemaName,
    { sendTelegram }
  );
  await updateConversationState(request.sessionId, {
    lastBotAction: 'escalate',
    awaitingContactInfo: true,
    escalationTimestamp: new Date().toISOString(),
    escalationReason: 'ai_escalated'
  });
}

async function cacheGeneratedResponse(request) {
  if (request.response.action !== 'answer' ||
      request.response.confidence < 0.8 ||
      !request.needsKBSearch ||
      !request.queryEmbedding) {
    return;
  }

  try {
    await setSemanticCache(
      request.schemaName,
      request.queryHash,
      {
        answer: request.response.answer,
        action: request.response.action,
        confidence: request.response.confidence,
        sources: request.response.sources
      },
      request.queryEmbedding
    );
  } catch {
    // Cache failures must not fail a successful chat response.
  }
}

async function sendCachedResponse(res, request, cachedResult, cacheType) {
  const response = {
    ...cachedResult,
    action: cachedResult.action || 'answer',
    model: cachedResult.model || 'cache',
    tokens: 0
  };
  const latencyMs = Date.now() - request.startedAt;

  await appendRedisHistory(request.session.conversationId, request.message, response);
  const ids = await persistExchange({
    supabaseClient: request.req.supabase,
    session: request.session,
    employeeId: request.session.employeeId,
    userMessage: request.message,
    response,
    metadata: buildResponseMetadata({
      response,
      intent: 'domain_question',
      contexts: response.sources || [],
      latencyMs,
      cached: true,
      cacheType
    })
  });
  const messageId = ids.assistantId;
  tagQuestionTopic(request, ids.userId);
  await touchSession(request.sessionId);

  return res.json({
    success: true,
    data: {
      ...cachedResult,
      action: response.action,
      escalated: false,
      messageId,
      sessionId: request.sessionId,
      conversationId: request.session.conversationId,
      cached: true
    }
  });
}

async function appendRedisHistory(conversationId, userMessage, response) {
  await addMessageToHistory(conversationId, { role: 'user', content: userMessage });
  await addMessageToHistory(conversationId, {
    role: 'assistant',
    content: response.answer,
    confidence: response.confidence,
    sources: response.sources,
    action: response.action
  });
}

async function persistExchange({
  supabaseClient,
  session,
  employeeId,
  userMessage,
  response,
  metadata
}) {
  const { data, error } = await supabaseClient
    .from('chat_history')
    .insert([
      {
        conversation_id: session.conversationId,
        employee_id: employeeId,
        role: 'user',
        content: userMessage,
        metadata: {}
      },
      {
        conversation_id: session.conversationId,
        employee_id: employeeId,
        role: 'assistant',
        content: response.answer,
        confidence_score: response.confidence,
        sources: response.sources || [],
        metadata
      }
    ])
    .select('id, role');
  if (error) {
    console.error('Error saving chat exchange:', error);
    return { assistantId: null, userId: null };
  }
  return {
    assistantId: data?.find(item => item.role === 'assistant')?.id || null,
    userId: data?.find(item => item.role === 'user')?.id || null
  };
}

/**
 * Fire-and-forget: classify the question into a reporting topic and store it on
 * the user message metadata. Runs after the response is sent (no added latency).
 * Greetings/conversational filler are skipped — they are not real questions.
 */
function tagQuestionTopic(request, userMessageId) {
  if (!userMessageId) return;
  const fastPath = classifyMessageIntentFastPath(request.message);
  if (fastPath === 'greeting' || fastPath === 'conversational') return;

  resolveQuestionTopic({
    message: request.message,
    schemaName: request.schemaName,
    queryHash: request.queryHash
  })
    .then(topic => {
      if (!topic) return; // greeting / non-question — never tagged
      return request.req.supabase
        .from('chat_history')
        .update({ metadata: { topic } })
        .eq('id', userMessageId);
    })
    .catch(error => console.error('[topic] tagging failed:', error?.message));
}

function buildResponseMetadata(input) {
  const response = input.response;
  const contexts = input.contexts || [];
  const similarities = contexts
    .map(context => Number(context.similarity))
    .filter(Number.isFinite);
  return {
    model: response.model,
    tokens: response.tokens || 0,
    action: response.action,
    intent: input.intent,
    latency_ms: input.latencyMs,
    cached: input.cached || false,
    cache_type: input.cacheType || null,
    best_similarity: similarities.length ? Math.max(...similarities) : null,
    average_similarity: similarities.length
      ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length
      : null
  };
}

function responsePayload(request) {
  return {
    answer: request.response.answer,
    action: request.response.action,
    confidence: request.response.confidence,
    sources: request.response.sources,
    escalated: request.escalated,
    messageId: request.assistantMessageId,
    sessionId: request.sessionId,
    conversationId: request.session.conversationId
  };
}

function resetFailureState() {
  return {
    failedKBAttempts: 0,
    askedToElaborate: false,
    lastFailedQuery: null,
    consecutiveEscalations: 0
  };
}

function classifyMessageIntentFastPath(message) {
  const normalized = message.trim();
  const greeting = /^(hi+|hello+|hey+|good (morning|afternoon|evening|day)|howdy|greetings|sup|yo|what'?s up|how are you|how r u|你好|早上好|下午好|晚上好|嗨|喂)\W*$/i;
  const conversational = /^(ok|okay|got it|i see|sure|alright|understood|noted|cool|great|sounds good|perfect|thanks|thank you|ty|thx|no problem|np|bye|goodbye|see you|take care|谢谢|好的|明白)\W*$/i;
  if (greeting.test(normalized)) return 'greeting';
  if (conversational.test(normalized)) return 'conversational';
  return 'unknown';
}

async function classifyMessageIntentLLM(message, conversationHistory = []) {
  const lastAssistant = conversationHistory
    .filter(item => item.role === 'assistant')
    .slice(-1)[0]?.content || '';
  const prompt = `Classify this insurance chatbot message.
Categories: domain_question, correction, contact_info, meta_request, follow_up.
contact_info means raw contact details, not a question about updating details.
Last bot message: "${lastAssistant.substring(0, 200)}"
User message: "${message.substring(0, 200)}"
Reply with only the category name.`;
  const response = await classificationClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 20
  });
  const result = response.choices[0].message.content.trim().toLowerCase();
  const valid = new Set([
    'domain_question',
    'correction',
    'contact_info',
    'meta_request',
    'follow_up'
  ]);
  return valid.has(result) ? result : 'domain_question';
}
