import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const CHAT_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
const TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE) || 0;
const MAX_TOKENS = parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;

/**
 * Generate embeddings for text using OpenAI's embedding model
 * @param {string} text - Text to generate embeddings for
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function generateEmbedding(text) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts to generate embeddings for
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function generateEmbeddingsBatch(texts) {
  try {
    if (!texts || texts.length === 0) {
      throw new Error('Texts array cannot be empty');
    }

    // Track which indices have valid text vs empty (preserves alignment)
    const indexMap = [];
    const validTexts = [];
    for (let i = 0; i < texts.length; i++) {
      if (texts[i] && texts[i].trim().length > 0) {
        indexMap.push(i);
        validTexts.push(texts[i].trim());
      }
    }

    if (validTexts.length === 0) {
      throw new Error('No valid texts provided');
    }

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: validTexts,
      encoding_format: 'float'
    });

    // Rebuild full array with nulls for empty texts (preserves index alignment)
    const result = new Array(texts.length).fill(null);
    response.data.forEach((item, idx) => {
      result[indexMap[idx]] = item.embedding;
    });

    return result;
  } catch (error) {
    console.error('Error generating batch embeddings:', error.message);
    throw new Error(`Failed to generate batch embeddings: ${error.message}`);
  }
}

// injectConversationContextAwareness removed — logic now embedded in XML system prompt

/**
 * Create RAG prompt with retrieved context using XML-structured format
 * @param {string} query - User query
 * @param {Array} contexts - Retrieved context chunks
 * @param {Object} employeeData - Employee information
 * @param {number} similarityThreshold - The threshold used for knowledge search
 * @returns {string} - Formatted system prompt (query injected separately via user message)
 */
function createRAGPrompt(query, contexts, employeeData, conversationHistory = [], similarityThreshold = 0.55, failedKBAttempts = 0) {
  const contextText = contexts && contexts.length > 0
    ? contexts.map((ctx, idx) => {
        // Clean title artifacts: [SECTION: ...] markers, markdown #, bold **
        const cleanTitle = (ctx.title || 'N/A')
          .replace(/^\[SECTION:\s*/, '').replace(/\]$/, '')
          .replace(/^#+\s*/, '')
          .replace(/\*{1,3}/g, '')
          .trim() || 'N/A';
        return `[Context ${idx + 1}]\n` +
          `Title: ${cleanTitle}\n` +
          `Category: ${ctx.category}\n` +
          `Content: ${ctx.content}`;
      }).join('\n\n---\n\n')
    : '[NO KNOWLEDGE BASE DATA AVAILABLE FOR THIS QUERY]';

  const employeeInfo = employeeData ? `
- Name: ${employeeData.name}
- Employee ID: ${employeeData.employee_id || 'N/A'}
- User ID: ${employeeData.user_id || 'N/A'}
- Email: ${employeeData.email || 'N/A'}
` : 'No employee information available.';

  // Format conversation history as text (last 20 turns = 40 messages)
  const recentHistory = conversationHistory.slice(-40);
  const historyText = recentHistory.length > 0
    ? recentHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')
    : 'No prior conversation.';

  return `<system_persona>
You are an AI assistant for an employee insurance benefits portal. Your primary goal is to provide accurate, helpful, and empathetic support based STRICTLY on the provided knowledge base and the logged-in employee's specific data.
</system_persona>

<operational_rules>
1. PRIMARY SOURCE TRUTH: You must answer using ONLY the context provided in <knowledge_base> and <employee_information>.
2. EXACT ANSWERS: If a <knowledge_base> entry contains a "Title" and "Content" field that matches the user's intent, use the facts from the "Content" field DIRECTLY. You may rephrase for conversational flow, but do not alter the facts.
3. NO HALLUCINATION: Never make assumptions about coverage, policies, or claims not explicitly stated in the provided context. You do not have web search capabilities.
4. RELEVANCE JUDGMENT: If <knowledge_base> contains results but they do NOT actually answer the user's question (e.g., similar keywords but different topic), treat it as if the knowledge base is empty and follow the escalation rules. Do NOT fabricate an answer from unrelated context.
5. PORTAL REFERRAL: For questions about specific plan coverage, benefits limits, claim amounts, or policy details that are not found in the <knowledge_base>, guide the user to check their employee benefits portal for their plan-specific details (e.g., "For your specific plan coverage and limits, you may refer to your employee benefits portal."). Include this alongside the escalation message when applicable.
</operational_rules>

<privacy_and_security>
CRITICAL: You are operating in a strict data privacy environment.
1. NEVER provide information about OTHER employees (names, claims, benefits, personal data).
2. ONLY discuss the logged-in employee's own information shown in <employee_information>.
3. If asked about a colleague, non-dependent family member, or any other person, you must REFUSE to answer and do not escalate. Use these exact phrases:
   - English: "I can only provide information about your own insurance benefits and coverage. For privacy reasons, I cannot access or discuss other employees' information."
   - Chinese: "我只能提供您自己的保险福利和保障信息。出于隐私原因，我无法访问或讨论其他员工的信息。"
</privacy_and_security>

<escalation_and_state_management>
The current failed KB attempt count is: ${failedKBAttempts}

"No useful KB" means: the <knowledge_base> is either empty OR contains results that do NOT actually answer the user's question (similar keywords but different topic).

Follow these rules:

1. NO USEFUL KB (attempt count <= 1, first time for this topic): Ask the user to elaborate once (e.g., "Could you provide more details about what you're looking for?").
2. NO USEFUL KB (attempt count >= 2, OR you already asked to elaborate in the <conversation_history> for this same topic): You MUST escalate immediately. Do NOT ask for more details again.
3. ESCALATION MESSAGES:
   - English: "For such a query, let us check back with the team. You may leave your contact or email address for our team to follow up with you. Thank you."
   - Chinese: "对于此类查询，我们需要与团队核实。您可以留下您的联系方式或电子邮箱，我们的团队会尽快与您联系。谢谢。"
4. HANDLING USER CONTACT INFO: ALWAYS review the conversation history. If your PREVIOUS message was an escalation/request for contact info, treat the user's current response as contact data.
   - Triggers: Pure numbers (8+ digits), email formats (xxx@xxx.xxx), mixed numbers with country codes (+65...), or domain styles (name.company.com).
   - Action: Acknowledge receipt. DO NOT ask "what does this mean". DO NOT re-escalate.
   - Acknowledgment Phrase: "Thank you for providing your contact information. Our team has received your inquiry and will follow up with you shortly."
5. CORRECTION HANDLING: If the user says "ignore", "wrong", or corrects a previous message, acknowledge it simply (e.g., "No problem, noted.") and allow them to proceed. Do not escalate corrections.
</escalation_and_state_management>

<formatting_guidelines>
- Use clean, readable formatting with Markdown.
- Use hyphens (-) for bulleted lists, not asterisks.
- Present coverage details in a clean list format.
- Use **bold text** sparingly, only for crucial numbers or key terms.
- Keep paragraphs short, concise, and professional. Prioritize clarity over stylistic flair.
- ALWAYS detect and respond in the SAME language as the user's question.
</formatting_guidelines>

<employee_information>
${employeeInfo}
</employee_information>

<knowledge_base>
${contextText}
</knowledge_base>

<conversation_history>
${historyText}
</conversation_history>

<user_query>
${query}
</user_query>`;
}

/**
 * Generate chat completion using OpenAI with RAG context
 * @param {string} query - User query
 * @param {Array} contexts - Retrieved context chunks from vector DB
 * @param {Object} employeeData - Employee information
 * @param {Array} conversationHistory - Previous conversation messages
 * @param {Object} customSettings - Optional custom AI settings from company config
 * @returns {Promise<Object>} - Response with answer and metadata
 */
export async function generateRAGResponse(query, contexts, employeeData, conversationHistory = [], customSettings = null, messageIntent = null, failedKBAttempts = 0) {
  try {
    // Use custom settings if provided, otherwise use environment defaults
    const model = customSettings?.model || CHAT_MODEL;
    const temperature = customSettings?.temperature ?? TEMPERATURE;
    const maxTokens = customSettings?.max_tokens ?? MAX_TOKENS;
    const similarityThreshold = customSettings?.similarity_threshold ?? 0.55;
    const topKResults = customSettings?.top_k_results ?? 5;


    // Always use backend-managed prompt — frontend no longer overrides
    const systemPrompt = createRAGPrompt(query, contexts, employeeData, conversationHistory, similarityThreshold, failedKBAttempts);

    // System prompt contains all context (employee, KB, history, query) in XML structure
    // Send as single system message + one user message for the current query
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ];

    const response = await openai.chat.completions.create({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0
    });

    const answer = response.choices[0].message.content;
    const finishReason = response.choices[0].finish_reason;

    // Calculate confidence score based on various factors
    const confidence = calculateConfidence(answer, contexts, finishReason, messageIntent);

    // Calculate knowledge match metadata
    const knowledgeMatch = calculateKnowledgeMatch(contexts);

    return {
      answer,
      confidence,
      sources: contexts.map(ctx => ({
        id: ctx.id,
        title: ctx.title,
        category: ctx.category,
        similarity: ctx.similarity
      })),
      knowledgeMatch,
      model: model,
      tokens: response.usage.total_tokens,
      finishReason
    };
  } catch (error) {
    console.error('Error generating RAG response:', error.message);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

/**
 * Calculate knowledge match metadata
 * @param {Array} contexts - Retrieved contexts
 * @returns {Object} - Knowledge match information
 */
function calculateKnowledgeMatch(contexts) {
  // Check if knowledge base has ANY data related to this query (even if low similarity)
  const hasAnyKnowledgeInDB = contexts._hasAnyKnowledge;

  // If no contexts returned AND no knowledge exists in DB at all -> true no_knowledge
  if (!contexts || contexts.length === 0) {
    return {
      hasKnowledge: hasAnyKnowledgeInDB, // True if DB has data, even if below threshold
      matchCount: 0,
      avgSimilarity: 0,
      bestMatch: null,
      status: hasAnyKnowledgeInDB ? 'poor_match' : 'no_knowledge'
    };
  }

  // If we have results, analyze them
  const avgSimilarity = contexts.reduce((sum, ctx) => sum + ctx.similarity, 0) / contexts.length;
  const bestMatch = Math.max(...contexts.map(ctx => ctx.similarity));

  return {
    hasKnowledge: true,
    matchCount: contexts.length,
    avgSimilarity,
    bestMatch,
    status: contexts.length >= 2 ? 'good_match' : 'partial_match'
  };
}

/**
 * Calculate confidence score for the response
 * @param {string} answer - Generated answer
 * @param {Array} contexts - Retrieved contexts
 * @param {string} finishReason - OpenAI finish reason
 * @returns {number} - Confidence score between 0 and 1
 */
function calculateConfidence(answer, contexts, finishReason, messageIntent = null) {
  // Non-KB intents get high confidence — they don't need KB data
  const nonKBIntents = ['correction', 'contact_info', 'greeting', 'conversational'];
  if (messageIntent && nonKBIntents.includes(messageIntent)) {
    return 0.9;
  }

  // KB-based confidence: derived purely from similarity scores of retrieved contexts.
  // Used for caching decisions and metadata only — escalation is handled by the AI prompt.
  if (!contexts || contexts.length === 0) {
    return 0.3;
  }

  const avgSimilarity = contexts.reduce((sum, ctx) => sum + ctx.similarity, 0) / contexts.length;
  let confidence = 0.4 + (avgSimilarity * 0.5);

  if (finishReason === 'length') {
    confidence *= 0.9;
  }

  return Math.max(0, Math.min(1, confidence));
}

export default {
  generateEmbedding,
  generateEmbeddingsBatch,
  generateRAGResponse
};
