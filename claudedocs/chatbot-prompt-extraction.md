# Chatbot AI Prompt Setup Extraction

**Source File**: `backend/api/services/openai.js`
**Function**: `createRAGPrompt()` (lines 78-147)
**Extraction Date**: 2025-11-11

---

## System Prompt Template

```
You are an AI assistant for an employee insurance benefits portal. Your role is to help employees understand their insurance coverage, benefits, and claims procedures.

IMPORTANT INSTRUCTIONS:
1. Answer based on the provided context from knowledge base and employee information

2. CONTEXT USAGE PRIORITY: If context is provided from the knowledge base, USE IT to answer:
   a) The context has been matched with high similarity (>0.7) - it is relevant to the question
   b) Even if the context says "login to portal" or "contact support", that IS the correct answer
   c) Provide the answer/guidance from the context as-is - do NOT escalate
   d) Only add helpful details from employee information if relevant (like policy type, name, etc.)

3. ONLY escalate if NO context is provided AND you cannot answer from employee information

4. When escalating, say: "For such query, let us check back with the team. You may leave your contact or email address for our team to follow up with you. Thank you."

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
```

---

## Dynamic Context Injection

### Employee Information Section
The prompt dynamically includes employee-specific data when available:

```
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
```

### Knowledge Base Context Section
Retrieved context chunks from vector database search:

```
CONTEXT FROM KNOWLEDGE BASE:
[Context 1]
Category: ${ctx.category}
${ctx.content}

---

[Context 2]
Category: ${ctx.category}
${ctx.content}

(... additional contexts)
```

### User Query Section
```
USER QUESTION:
${query}

RESPONSE:
```

---

## OpenAI API Configuration

**Model Settings** (from `backend/api/services/openai.js:173-181`):
```javascript
{
  model: CHAT_MODEL,              // Default: 'gpt-4-turbo-preview'
  messages: messages,              // System prompt + conversation history + user query
  temperature: TEMPERATURE,        // Default: 0 (deterministic)
  max_tokens: MAX_TOKENS,          // Default: 1000
  top_p: 1.0,
  frequency_penalty: 0.0,
  presence_penalty: 0.0
}
```

**Environment Variables**:
- `OPENAI_MODEL`: Chat model (default: `gpt-4-turbo-preview`)
- `OPENAI_TEMPERATURE`: Temperature setting (default: `0`)
- `OPENAI_MAX_TOKENS`: Max response tokens (default: `1000`)
- `OPENAI_EMBEDDING_MODEL`: Embedding model (default: `text-embedding-3-small`)

---

## Conversation History Management

**History Handling** (line 167):
- Maintains last 10 messages (`conversationHistory.slice(-10)`)
- Structure: `[{ role: 'system'|'user'|'assistant', content: string }]`
- System prompt always at position 0
- Recent history appended after system prompt
- Current query appended as last message

---

## Response Metadata

The chatbot returns additional metadata alongside the answer:

```javascript
{
  answer: string,                    // AI-generated response
  confidence: number,                 // 0-1 confidence score
  sources: [                         // Context sources used
    {
      id: number,
      title: string,
      category: string,
      similarity: number
    }
  ],
  knowledgeMatch: {                  // Knowledge base match quality
    hasKnowledge: boolean,
    matchCount: number,
    avgSimilarity: number,
    bestMatch: number,
    status: 'good_match'|'partial_match'|'poor_match'|'no_knowledge'
  },
  model: string,                     // Model used
  tokens: number,                    // Total tokens consumed
  finishReason: string              // 'stop'|'length'|'content_filter'
}
```

---

## Confidence Scoring Algorithm

**Base**: 0.5
**Adjustments**:
- **+0.3 max**: Based on average context similarity
- **Cap at 0.5**: If uncertainty phrases detected (e.g., "I don't know", "cannot answer")
- **Boost to 0.75+**: If contact information acknowledgment detected
- **×0.9**: If response was cut off (`finishReason === 'length'`)

**Uncertainty Phrases** (triggers confidence reduction):
- "I don't have enough information"
- "I'm not sure"
- "I don't know"
- "cannot answer"
- "let me connect you with"
- "contact support"
- "speak with our team"
- "check back with the team"

**Contact Acknowledgment Phrases** (boosts confidence):
- "thank you for providing your contact"
- "our team has received your inquiry"
- "will follow up with you shortly"

---

## Key Features & Behavior

### 1. **RAG (Retrieval-Augmented Generation)**
- Embeds user query using `text-embedding-3-small`
- Retrieves relevant contexts from vector database (similarity >0.7 threshold)
- Injects contexts into system prompt for grounded responses

### 2. **Privacy Protection**
- Hard-coded rules against sharing other employees' data
- Can only discuss logged-in employee's information
- Refuses queries about other people without escalation

### 3. **Escalation Logic**
- Only escalates when NO context available AND cannot answer from employee data
- Standardized escalation message
- Contact information collection workflow

### 4. **Formatting Preferences**
- Markdown formatting
- Bullet points using `-` instead of `*`
- Minimal bold text usage
- Clean, readable structure

### 5. **Context Window Management**
- Maintains last 10 conversation messages
- Summarization available via `summarizeConversation()` function
- Uses `gpt-3.5-turbo` for summaries (cheaper/faster)

---

## Related Functions

### `summarizeConversation(messages)` (lines 312-339)
- **Purpose**: Compress long conversations into 2-3 sentence summaries
- **Model**: `gpt-3.5-turbo`
- **Temperature**: 0.3
- **Max Tokens**: 150
- **Use Case**: Context retention for very long conversations

### `generateEmbedding(text)` (lines 20-37)
- **Purpose**: Convert text to vector embeddings for similarity search
- **Model**: `text-embedding-3-small`
- **Output**: Float vector array

### `generateEmbeddingsBatch(texts)` (lines 44-69)
- **Purpose**: Batch embedding generation for efficiency
- **Model**: `text-embedding-3-small`
- **Optimization**: Processes multiple texts in single API call

---

## Prompt Engineering Insights

### Strengths
1. **Clear role definition**: "AI assistant for employee insurance benefits portal"
2. **Explicit context prioritization**: Forces AI to use retrieved knowledge
3. **Privacy-first**: Hard rules against data leakage
4. **Standardized escalation**: Consistent user experience
5. **Contact handling**: Prevents repetitive asks
6. **Formatting guidelines**: Consistent output style

### Potential Improvements
1. **Numbered instruction #4 duplicated**: Two instructions labeled "4"
2. **Hardcoded escalation message**: Could be configurable per company
3. **No tone adjustment**: Could vary formality based on company culture
4. **No multilingual support**: English-only responses
5. **No source citation**: Doesn't reference which knowledge article was used
6. **Limited personalization**: Could use employee's name more naturally

---

## Usage Example

**Input Query**: "What is my dental coverage limit?"

**System Processing**:
1. Generate embedding for query
2. Search vector DB for similar contexts (threshold >0.7)
3. Retrieve employee data (dental_limit: $1000)
4. Inject both into system prompt
5. Send to GPT-4 with conversation history
6. Calculate confidence score
7. Return answer + metadata

**Expected Output**:
```
Your dental coverage limit is $1,000 per policy year. This is part of your overall insurance benefits package.

[Sources: Dental Benefits Policy Document, similarity: 0.85]
[Confidence: 0.82]
```

---

## Maintenance Notes

- **File Location**: `backend/api/services/openai.js`
- **Last Modified**: Check git log for timestamp
- **Dependencies**: `openai` npm package, environment variables
- **Testing**: See `backend/scripts/test-security.js` for security validation

