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
 * Create RAG prompt with retrieved context
 * @param {string} query - User query
 * @param {Array} contexts - Retrieved context chunks
 * @param {Object} employeeData - Employee information
 * @returns {string} - Formatted prompt with context
 */
function createRAGPrompt(query, contexts, employeeData) {
  const contextText = contexts
    .map((ctx, idx) => `[Context ${idx + 1}]\nCategory: ${ctx.category}\n${ctx.content}`)
    .join('\n\n---\n\n');

  const employeeInfo = employeeData ? `
Employee Information:
- Name: ${employeeData.name}
- Employee ID: ${employeeData.employee_id || 'N/A'}
- User ID: ${employeeData.user_id || 'N/A'}
- Email: ${employeeData.email || 'N/A'}
- Policy Type: ${employeeData.policy_type}
- Coverage Limit: $${employeeData.coverage_limit}
- Annual Claim Limit: $${employeeData.annual_claim_limit}
- Outpatient Limit: $${employeeData.outpatient_limit || 'N/A'}
- Dental Limit: $${employeeData.dental_limit || 'N/A'}
- Optical Limit: $${employeeData.optical_limit || 'N/A'}
- Policy Period: ${employeeData.policy_start_date} to ${employeeData.policy_end_date}
` : '';

  return `You are an AI assistant for an employee insurance benefits portal. Your role is to help employees understand their insurance coverage, benefits, and claims procedures.

IMPORTANT INSTRUCTIONS:
1. Answer ONLY based on the provided context and employee information
2. COVERAGE QUESTIONS - USE EMPLOYEE DATA: When asked about "what does my plan cover", "coverage limits", "benefits", or "plan details":
   a) The Employee Information section below contains the user's actual coverage limits
   b) Provide specific amounts from Coverage Limit, Annual Claim Limit, Outpatient/Dental/Optical Limits
   c) DO NOT escalate if employee data has valid amounts - use them to answer!
   d) ONLY escalate if Employee Information shows "N/A" or null for the requested information
   e) Even if knowledge base says "login to portal", you should still answer using the employee data provided
3. If information is not in EITHER the context OR employee information, say "For such query, let us check back with the team. You may leave your contact or email address for our team to follow up with you. Thank you."
4. Be specific about policy limits, coverage amounts, and procedures
5. Use clear, professional, and empathetic language
6. If asked about claims status or personal medical information, direct to appropriate channels
7. Never make assumptions about coverage not explicitly stated in the context or employee information
8. CONTACT INFORMATION HANDLING:
   - If user provides contact information (email address, phone number, or digits), acknowledge it professionally
   - Say: "Thank you for providing your contact information. Our team has received your inquiry and will follow up with you shortly."
   - DO NOT ask for contact information again if already provided
   - DO NOT repeat the escalation message
   - Recognize these patterns as contact info: emails (name@domain.com), phone numbers (8+ digits), mobile numbers

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
 * @returns {Promise<Object>} - Response with answer and metadata
 */
export async function generateRAGResponse(query, contexts, employeeData, conversationHistory = []) {
  try {
    const systemPrompt = createRAGPrompt(query, contexts, employeeData);

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
      model: CHAT_MODEL,
      messages: messages,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
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
      model: CHAT_MODEL,
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
    confidence += avgSimilarity * 0.3; // Max +0.3 from context similarity
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
    confidence = Math.min(confidence, 0.5); // Cap at 0.5 if uncertain
  }

  // Boost confidence for contact acknowledgments (these are valid responses)
  if (isContactAcknowledgment) {
    confidence = Math.max(confidence, 0.75); // Higher confidence for acknowledgments
  }

  // Adjust based on finish reason
  if (finishReason === 'length') {
    confidence *= 0.9; // Slightly reduce if response was cut off
  }

  // Ensure confidence is between 0 and 1
  return Math.max(0, Math.min(1, confidence));
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
