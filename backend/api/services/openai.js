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

    // Filter out empty texts
    const validTexts = texts.filter(t => t && t.trim().length > 0);

    if (validTexts.length === 0) {
      throw new Error('No valid texts provided');
    }

    // OpenAI API supports batch embeddings
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: validTexts.map(t => t.trim()),
      encoding_format: 'float'
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Error generating batch embeddings:', error.message);
    throw new Error(`Failed to generate batch embeddings: ${error.message}`);
  }
}

/**
 * Inject conversation context awareness instructions into any prompt
 * This ensures all prompts (custom or default) understand conversation flow
 * @param {string} prompt - System prompt to enhance
 * @returns {string} - Prompt with context awareness instructions appended
 */
function injectConversationContextAwareness(prompt) {
  const contextAwarenessInstructions = `

CRITICAL: CONVERSATION CONTEXT AWARENESS - ALWAYS APPLY THIS:
- ALWAYS review the conversation history BEFORE responding
- Check what YOUR PREVIOUS MESSAGE said - this is critical for understanding context
- If YOUR PREVIOUS MESSAGE asked for contact information or contained an escalation phrase:
  * The current user message is VERY LIKELY their contact information
  * A standalone number (8+ digits) = phone number
  * An email format (xxx@xxx.xxx) = email address
  * DO NOT ask "what does this mean" or "I need more context"
- Pattern recognition for contact info responses:
  * Pure numbers like "88399967" or "12345678" after escalation = phone number
  * Email format like "user@email.com" after escalation = email address
  * Mixed format like "+65 8839 9967" = phone number with country code
- When user provides contact information (especially after escalation):
  * Acknowledge professionally: "Thank you for providing your contact information. Our team has received your inquiry and will follow up with you shortly."
  * DO NOT ask for contact information again if already provided
  * DO NOT repeat the escalation message
  * DO NOT ask for clarification when context is obvious from conversation history`;

  return prompt + contextAwarenessInstructions;
}

/**
 * Inject variables into custom prompt template
 * @param {string} template - Custom prompt template with {{VARIABLES}}
 * @param {Object} data - Data to inject (query, contexts, employeeData, etc.)
 * @returns {string} - Prompt with variables replaced
 */
function injectVariablesIntoPrompt(template, data) {
  const { query, contexts, employeeData, similarityThreshold, topKResults, contextCount } = data;

  // Format context text with clear Q&A structure
  const contextText = contexts && contexts.length > 0
    ? contexts.map((ctx, idx) =>
        `[Context ${idx + 1}]\n` +
        `Question: ${ctx.title || 'N/A'}\n` +
        `Category: ${ctx.category}\n` +
        `Similarity: ${ctx.similarity?.toFixed(4) || 'N/A'}\n` +
        `Answer: ${ctx.content}`
      ).join('\n\n---\n\n')
    : 'No knowledge base context available for this query.';

  // Format employee info (policy details not included for security)
  const employeeInfo = employeeData ? `
Employee Information:
- Name: ${employeeData.name}
- Employee ID: ${employeeData.employee_id || 'N/A'}
- User ID: ${employeeData.user_id || 'N/A'}
- Email: ${employeeData.email || 'N/A'}

Note: For your specific policy details and coverage limits, please refer to your employee portal.
` : 'No employee information available.';

  // Replace all variables in template
  let result = template
    // Configuration variables
    .replace(/\{\{SIMILARITY_THRESHOLD\}\}/g, similarityThreshold.toFixed(2))
    .replace(/\{\{TOP_K_RESULTS\}\}/g, topKResults)
    .replace(/\{\{CONTEXT_COUNT\}\}/g, contextCount)

    // Query variable
    .replace(/\{\{QUERY\}\}/g, query)
    .replace(/\{\{USER_QUESTION\}\}/g, query)

    // Context variables
    .replace(/\{\{CONTEXT\}\}/g, contextText)
    .replace(/\{\{CONTEXTS\}\}/g, contextText)
    .replace(/\{\{KNOWLEDGE_BASE\}\}/g, contextText)

    // Employee variables
    .replace(/\{\{EMPLOYEE_INFO\}\}/g, employeeInfo)
    .replace(/\{\{EMPLOYEE_NAME\}\}/g, employeeData?.name || 'N/A')
    .replace(/\{\{EMPLOYEE_ID\}\}/g, employeeData?.employee_id || 'N/A')
    .replace(/\{\{EMPLOYEE_EMAIL\}\}/g, employeeData?.email || 'N/A');

  return result;
}

/**
 * Create RAG prompt with retrieved context
 * @param {string} query - User query
 * @param {Array} contexts - Retrieved context chunks
 * @param {Object} employeeData - Employee information
 * @param {number} similarityThreshold - The threshold used for knowledge search
 * @returns {string} - Formatted prompt with context
 */
function createRAGPrompt(query, contexts, employeeData, similarityThreshold = 0.7) {
  const contextText = contexts
    .map((ctx, idx) =>
      `[Context ${idx + 1}]\n` +
      `Question: ${ctx.title || 'N/A'}\n` +
      `Category: ${ctx.category}\n` +
      `Answer: ${ctx.content}`
    )
    .join('\n\n---\n\n');

  const employeeInfo = employeeData ? `
Employee Information:
- Name: ${employeeData.name}
- Employee ID: ${employeeData.employee_id || 'N/A'}
- User ID: ${employeeData.user_id || 'N/A'}
- Email: ${employeeData.email || 'N/A'}

Note: For your specific policy details and coverage limits, please refer to your employee portal.
` : '';

  return `You are an AI assistant for an employee insurance benefits portal. Your role is to help employees understand their insurance coverage, benefits, and claims procedures.

IMPORTANT INSTRUCTIONS:
1. Answer based on the provided context from knowledge base and employee information
2. CONTEXT USAGE PRIORITY: If context is provided from the knowledge base, USE IT to answer:
   a) The context has been matched with similarity >${similarityThreshold.toFixed(2)} - it is relevant and has passed our quality threshold
   b) CRITICAL: Each context entry has a "Question" and an "Answer" field
   c) CRITICAL: The "Answer" field contains the EXACT answer you should provide - USE IT DIRECTLY
   d) DO NOT generate your own answer - the "Answer" field IS the correct response
   e) Even if the Answer says "login to portal" or "contact support", that IS the correct answer - provide it exactly as given
   f) You may rephrase the Answer slightly for clarity, but DO NOT change the core information or instructions
   g) Only add helpful details from employee information if relevant (like policy type, name, etc.)
3. ONLY escalate if NO context is provided AND you cannot answer from employee information
4. When escalating, say: "For such query, let us check back with the team. You may leave your contact or email address for our team to follow up with you. Thank you."
5. Be specific about policy limits, coverage amounts, and procedures
6. Use clear, professional, and empathetic language
7. If asked about claims status or personal medical information, direct to appropriate channels
8. Never make assumptions about coverage not explicitly stated in the context or employee information

CRITICAL DATA PRIVACY RULES:
9. NEVER provide information about OTHER employees (names, claims, benefits, personal data)
10. You can ONLY discuss the logged-in employee's own information shown in "Employee Information" section
11. If asked about another person (colleague, family member not in dependents, other employee):
    - REFUSE to answer with: "I can only provide information about your own insurance benefits and coverage. For privacy reasons, I cannot access or discuss other employees' information."
    - DO NOT escalate queries about other employees - simply refuse
12. NEVER search the web or external sources for employee data - you do NOT have web search capabilities
13. NEVER hallucinate or guess information not explicitly provided in the context
14. If you don't know something, use the escalation phrase from instruction #3 - never make up information

FORMATTING GUIDELINES:
- Use clean, readable formatting with markdown
- Use bullet points (using -) for lists instead of asterisks
- Use bold text sparingly for emphasis on key information only
- Keep paragraphs short and concise
- For coverage details, present them in a clean list format
- Avoid excessive formatting - prioritize clarity over style

${employeeInfo}

CONTEXT FROM KNOWLEDGE BASE:
${contextText}

USER QUESTION:
${query}

RESPONSE:`;
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
export async function generateRAGResponse(query, contexts, employeeData, conversationHistory = [], customSettings = null) {
  try {
    // Use custom settings if provided, otherwise use environment defaults
    const model = customSettings?.model || CHAT_MODEL;
    const temperature = customSettings?.temperature ?? TEMPERATURE;
    const maxTokens = customSettings?.max_tokens ?? MAX_TOKENS;
    const customPrompt = customSettings?.system_prompt;
    const similarityThreshold = customSettings?.similarity_threshold ?? 0.7;
    const topKResults = customSettings?.top_k_results ?? 5;


    let systemPrompt;

    // If custom prompt is provided, inject variables into it
    if (customPrompt) {

      // Inject variables into custom prompt
      systemPrompt = injectVariablesIntoPrompt(customPrompt, {
        query,
        contexts,
        employeeData,
        similarityThreshold,
        topKResults,
        contextCount: contexts?.length || 0
      });

    } else {
      systemPrompt = createRAGPrompt(query, contexts, employeeData, similarityThreshold);
    }

    // CRITICAL: Always inject conversation context awareness into ANY prompt (custom or default)
    // This ensures the AI understands conversation flow regardless of prompt source
    systemPrompt = injectConversationContextAwareness(systemPrompt);

    // Log the complete system prompt for debugging (only in development or when needed)
    if (process.env.LOG_FULL_PROMPTS === 'true') {
    }

    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history (limit to last 5 exchanges)
    const recentHistory = conversationHistory.slice(-10);
    messages.push(...recentHistory);

    // Add current query
    messages.push({ role: 'user', content: query });

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
    const confidence = calculateConfidence(answer, contexts, finishReason);

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
function calculateConfidence(answer, contexts, finishReason) {

  let confidence = 0.5; // Base confidence

  // Increase confidence if we have relevant contexts
  if (contexts && contexts.length > 0) {
    const avgSimilarity = contexts.reduce((sum, ctx) => sum + ctx.similarity, 0) / contexts.length;
    const contextBoost = avgSimilarity * 0.3;
    confidence += contextBoost;
  } else {
  }

  // Decrease confidence if answer indicates uncertainty
  const uncertaintyPhrases = [
    "I don't have enough information",
    "I'm not sure",
    "I don't know",
    "cannot answer",
    "let me connect you with",
    "contact support",
    "speak with our team",
    "check back with the team"
  ];

  // Don't penalize confidence for contact acknowledgments
  const contactAcknowledgmentPhrases = [
    "thank you for providing your contact",
    "our team has received your inquiry",
    "will follow up with you shortly"
  ];

  const isContactAcknowledgment = contactAcknowledgmentPhrases.some(phrase =>
    answer.toLowerCase().includes(phrase.toLowerCase())
  );

  const hasUncertainty = uncertaintyPhrases.some(phrase =>
    answer.toLowerCase().includes(phrase.toLowerCase())
  );


  // Only reduce confidence if uncertain AND not a contact acknowledgment
  if (hasUncertainty && !isContactAcknowledgment) {
    const beforeCap = confidence;
    confidence = Math.min(confidence, 0.5); // Cap at 0.5 if uncertain
  }

  // Boost confidence for contact acknowledgments (these are valid responses)
  if (isContactAcknowledgment) {
    const beforeBoost = confidence;
    confidence = Math.max(confidence, 0.75); // Higher confidence for acknowledgments
  }

  // Adjust based on finish reason
  if (finishReason === 'length') {
    const beforeAdjust = confidence;
    confidence *= 0.9; // Slightly reduce if response was cut off
  }

  // Ensure confidence is between 0 and 1
  const finalConfidence = Math.max(0, Math.min(1, confidence));

  return finalConfidence;
}

/**
 * Generate a summary of conversation for context retention
 * @param {Array} messages - Conversation messages
 * @returns {Promise<string>} - Summary text
 */
export async function summarizeConversation(messages) {
  try {
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Summarize the following conversation in 2-3 sentences, focusing on the main questions and key information discussed.'
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
      temperature: 0.3,
      max_tokens: 150
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error summarizing conversation:', error.message);
    return 'Conversation about insurance benefits and coverage.';
  }
}

export default {
  generateEmbedding,
  generateEmbeddingsBatch,
  generateRAGResponse,
  summarizeConversation
};
