# Telegram Workflow Documentation

## Overview

This document provides a comprehensive explanation of the Telegram integration workflow in the Insurance Chatbot system. The Telegram bot serves as the Human-in-the-Loop (HITL) interface, allowing human operators to review and respond to escalated queries when the AI lacks sufficient knowledge or confidence.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Setup and Configuration](#setup-and-configuration)
3. [Bot Initialization](#bot-initialization)
4. [Message Flow](#message-flow)
5. [Escalation Workflow](#escalation-workflow)
6. [Response Handling](#response-handling)
7. [Contact Information Extraction](#contact-information-extraction)
8. [Commands Reference](#commands-reference)
9. [Database Integration](#database-integration)
10. [Technical Implementation](#technical-implementation)

---

## System Architecture

### Components

```
┌─────────────────┐
│   User Widget   │
│  (Chat Client)  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Chat API      │
│  (Express)      │
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌─────────┐ ┌──────────────┐
│ OpenAI  │ │  Vector DB   │
│   API   │ │  (Supabase)  │
└─────────┘ └──────────────┘
    │              │
    └──────┬───────┘
           ↓
   ┌───────────────┐
   │  Escalation   │
   │    Logic      │
   └───────┬───────┘
           │
           ↓
   ┌───────────────┐
   │  Telegram Bot │
   │   (Telegraf)  │
   └───────┬───────┘
           │
           ↓
   ┌───────────────┐
   │  Telegram     │
   │  Chat/Group   │
   └───────────────┘
```

### Key Files

- **`backend/api/services/telegram.js`** - Main Telegram bot implementation
- **`backend/api/routes/chat.js`** - Chat API and escalation trigger logic
- **`backend/api/services/openai.js`** - AI response generation and confidence calculation
- **`backend/server.js`** - Server initialization and bot startup

---

## Setup and Configuration

### Environment Variables

The Telegram integration requires the following environment variables in `.env`:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-group-chat-id

# Escalation Configuration
ESCALATE_ON_NO_KNOWLEDGE=true          # Escalate when no KB match found
ESCALATE_ON_LOW_CONFIDENCE=false       # Escalate on low confidence (optional)
MIN_KNOWLEDGE_SIMILARITY=0.4           # Minimum relevance threshold (0-1)
CONFIDENCE_THRESHOLD=0.7               # Confidence threshold for low confidence escalation
```

### Getting Telegram Credentials

1. **Create a Telegram Bot:**
   - Open Telegram and search for `@BotFather`
   - Send `/newbot` command
   - Follow prompts to create bot
   - Copy the `TELEGRAM_BOT_TOKEN` provided

2. **Get Chat ID:**
   - Add your bot to a Telegram group
   - Send a message in the group
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find the `chat.id` value (will be negative for groups)
   - Copy this as `TELEGRAM_CHAT_ID`

---

## Bot Initialization

### Startup Sequence

**File:** `backend/server.js:156-161`

```javascript
// Initialize Telegram bot
try {
  initializeTelegramBot();
} catch (error) {
  console.error('Failed to initialize Telegram bot:', error);
  console.warn('Continuing without Telegram integration...');
}
```

### Initialization Process

**File:** `backend/api/services/telegram.js:71-354`

1. **Bot Creation:**
   - Checks if `TELEGRAM_BOT_TOKEN` is set
   - Creates Telegraf instance
   - Logs initialization status

2. **Command Registration:**
   - `/start` - Welcome message and instructions
   - `/help` - Detailed help on responding to escalations
   - `/pending` - List pending escalations
   - `/stats` - Show escalation statistics

3. **Message Handler Setup:**
   - Listens for replies to escalation messages
   - Processes responses from human operators

4. **Bot Launch:**
   - Starts polling for updates
   - Sets up graceful shutdown handlers

---

## Message Flow

### 1. User Sends Message

**File:** `backend/api/routes/chat.js:76-225`

```
User → Widget → POST /api/chat/message
                      ↓
                 Session Check
                      ↓
                 Rate Limiting
                      ↓
                 Cache Check
                      ↓
              Knowledge Base Search
                      ↓
                AI Response Generation
                      ↓
               Confidence Calculation
                      ↓
              Escalation Check ←────┐
                      ↓              │
              (If needed) ────────────┘
                      ↓
            Response to User
```

### 2. Knowledge Base Search

**File:** `backend/api/routes/chat.js:138-142`

```javascript
// Search knowledge base
const contexts = await searchKnowledgeBase(message);

// Get conversation history
const history = await getConversationHistory(session.conversationId);

// Generate RAG response
const response = await generateRAGResponse(
  message,
  contexts,
  employee,
  formattedHistory
);
```

### 3. AI Response Generation

**File:** `backend/api/services/openai.js:130-183`

The `generateRAGResponse` function:
- Creates RAG prompt with context
- Includes employee information
- Adds conversation history
- Calls OpenAI API
- Calculates confidence score
- Calculates knowledge match metadata

### 4. Knowledge Match Calculation

**File:** `backend/api/services/openai.js:190-226`

```javascript
function calculateKnowledgeMatch(contexts) {
  const MIN_SIMILARITY = parseFloat(process.env.MIN_KNOWLEDGE_SIMILARITY) || 0.4;

  // Returns object with:
  // - hasKnowledge: boolean
  // - matchCount: number
  // - avgSimilarity: number (0-1)
  // - bestMatch: number (0-1)
  // - status: 'no_knowledge' | 'poor_match' | 'partial_match' | 'good_match'
}
```

---

## Escalation Workflow

### Escalation Decision Logic

**File:** `backend/api/routes/chat.js:177-189`

```javascript
let escalated = false;
let escalationReason = null;

// Only escalate when no knowledge found (no results from vector search)
if (ESCALATE_ON_NO_KNOWLEDGE && response.knowledgeMatch.status === 'no_knowledge') {
  escalated = true;
  escalationReason = 'no_knowledge_found';
}

if (escalated) {
  await handleEscalation(session, message, response, employee, escalationReason);
}
```

### Escalation Triggers

1. **No Knowledge Found** (Default: ON)
   - Vector search returns no results
   - `knowledgeMatch.status = 'no_knowledge'`
   - This is the ONLY escalation trigger

### Creating Escalation Record

**File:** `backend/api/routes/chat.js:361-423`

```javascript
async function handleEscalation(session, query, response, employee, reason) {
  // Get last assistant message ID
  const { data: lastMessage } = await supabase
    .from('chat_history')
    .select('id')
    .eq('conversation_id', session.conversationId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get recent conversation history for contact extraction
  const { data: recentMessages } = await supabase
    .from('chat_history')
    .select('role, content')
    .eq('conversation_id', session.conversationId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Create escalation record
  const { data: escalation, error } = await supabase
    .from('escalations')
    .insert([{
      conversation_id: session.conversationId,
      message_id: lastMessage?.id,
      employee_id: employee.id,
      query,
      context: {
        reason,
        aiResponse: response.answer,
        confidence: response.confidence,
        knowledgeMatch: response.knowledgeMatch,
        sources: response.sources,
        employee: {
          name: employee.name,
          policyType: employee.policy_type
        }
      },
      status: 'pending'
    }])
    .select()
    .single();

  // Notify via Telegram
  await notifyTelegramEscalation(escalation, query, employee, response, recentMessages);

  // Mark message as escalated
  await supabase
    .from('chat_history')
    .update({ was_escalated: true })
    .eq('id', lastMessage.id);
}
```

---

## Telegram Notification

### Notification Format

**File:** `backend/api/services/telegram.js:364-456`

The notification message includes:

1. **Employee Information:**
   - Name
   - Policy type
   - Coverage limit

2. **Contact Information:**
   - Registered email
   - Contact from chat (extracted)

3. **Query and Response:**
   - Original user question
   - AI's generated response (truncated if >500 chars)

4. **Escalation Context:**
   - Reason (No Knowledge/Poor Match/Low Confidence)
   - Knowledge source status
   - Number of sources and relevance

5. **Action Instructions:**
   - Reply "correct" if AI response is good
   - Reply with better answer to teach the bot
   - Reply "skip" to mark as reviewed

### Message Template

```
🔔 New Escalation

Employee: John Doe
Policy: Premium | Coverage: $100000

📧 Registered Email: john.doe@company.com
💬 Contact from Chat: 📧 john@gmail.com | 📱 +1-555-1234

Question:
What are my dental benefits?

🤖 AI Response:
For such query, let us check back with the team...

📊 Status: ❌ No Knowledge Base Match
Knowledge Sources: None found

[Escalation: 9bf1084b-86eb-4d97-bd76-946f831cca75]

✅ Reply "correct" if AI response is good
📝 Reply with better answer to teach the bot
⏭️ Reply "skip" to mark as reviewed
```

---

## Contact Information Extraction

### Extraction Function

**File:** `backend/api/services/telegram.js:25-66`

```javascript
function extractContactInfo(messages) {
  // Email pattern: standard email format
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

  // Phone pattern: flexible format
  const phoneRegex = /\b(\+?\d{1,4}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}\b/g;

  const emails = new Set();
  const phones = new Set();

  // Extract from user messages only
  messages.forEach(msg => {
    if (msg.role === 'user' || msg.content) {
      const content = msg.content || '';

      // Extract emails
      const foundEmails = content.match(emailRegex);
      if (foundEmails) {
        foundEmails.forEach(email => emails.add(email.toLowerCase()));
      }

      // Extract phones (filter valid phone numbers)
      const foundPhones = content.match(phoneRegex);
      if (foundPhones) {
        foundPhones.forEach(phone => {
          const cleaned = phone.replace(/[\s-()]/g, '');
          // Only 8-15 digits
          if (cleaned.length >= 8 && cleaned.length <= 15) {
            phones.add(phone.trim());
          }
        });
      }
    }
  });

  return {
    emails: Array.from(emails),
    phones: Array.from(phones),
    found: emails.size > 0 || phones.size > 0
  };
}
```

### Patterns Detected

1. **Email Addresses:**
   - Standard format: `name@domain.com`
   - Case-insensitive
   - Deduplicated

2. **Phone Numbers:**
   - International: `+1-555-1234`
   - Parentheses: `(555) 123-4567`
   - Dashes/spaces: `555-123-4567` or `555 123 4567`
   - Length validation: 8-15 digits

---

## Response Handling

### Message Handler

**File:** `backend/api/services/telegram.js:182-342`

```javascript
bot.on('message', async (ctx) => {
  // Check if reply to escalation
  if (!ctx.message.reply_to_message) return;

  const replyToText = ctx.message.reply_to_message.text;
  const response = ctx.message.text;

  // Extract escalation ID
  const escalationIdMatch = replyToText.match(/\[Escalation: ([a-f0-9-]+)\]/);
  if (!escalationIdMatch) return;

  const escalationId = escalationIdMatch[1];

  // Get escalation details
  const { data: escalation } = await supabase
    .from('escalations')
    .select('*, employees(*)')
    .eq('id', escalationId)
    .single();

  // Process response...
});
```

### Three Response Types

#### 1. Skip Response

**Keywords:** `skip`, `/skip`

```javascript
if (normalizedResponse === 'skip' || normalizedResponse === '/skip') {
  // Update escalation status to 'skipped'
  await supabase
    .from('escalations')
    .update({
      status: 'skipped',
      resolution: 'Reviewed but not added to knowledge base',
      resolved_by: ctx.from.username || ctx.from.first_name,
      resolved_at: new Date().toISOString()
    })
    .eq('id', escalationId);

  // Notify user
  ctx.reply('⏭️ Escalation skipped\n✓ Marked as reviewed\n✗ Not added to knowledge base');
}
```

#### 2. Correct Response

**Keywords:** `correct`, `✓`, `ok`, `/correct`

```javascript
const isCorrectCommand = normalizedResponse === 'correct' ||
                         normalizedResponse === '✓' ||
                         normalizedResponse === 'ok' ||
                         normalizedResponse === '/correct';

if (isCorrectCommand) {
  // Use AI's original response
  answerToSave = escalation.context?.aiResponse;
  resolvedStatus = 'AI response confirmed as correct';

  // Add to knowledge base with source_type: 'ai_confirmed'
  await addKnowledgeEntry({
    title: escalation.query.substring(0, 200),
    content: `Question: ${escalation.query}\n\nAnswer: ${answerToSave}`,
    category: 'hitl_learning',
    subcategory: escalation.employees?.policy_type || 'general',
    metadata: {
      escalation_id: escalationId,
      resolved_by: ctx.from.username,
      source_type: 'ai_confirmed'
    },
    source: 'hitl_learning'
  });
}
```

#### 3. Custom Answer Response

**Any other text**

```javascript
else {
  // Use human's custom answer
  answerToSave = response;
  resolvedStatus = 'Custom answer provided';

  // Add to knowledge base with source_type: 'human_provided'
  await addKnowledgeEntry({
    title: escalation.query.substring(0, 200),
    content: `Question: ${escalation.query}\n\nAnswer: ${answerToSave}`,
    category: 'hitl_learning',
    subcategory: escalation.employees?.policy_type || 'general',
    metadata: {
      escalation_id: escalationId,
      resolved_by: ctx.from.username,
      source_type: 'human_provided'
    },
    source: 'hitl_learning'
  });
}
```

### Knowledge Base Integration

All resolved escalations (except "skip") are added to the knowledge base:

**File:** `backend/api/services/telegram.js:294-314`

```javascript
await addKnowledgeEntry({
  title: escalation.query.substring(0, 200),
  content: `Question: ${escalation.query}\n\nAnswer: ${answerToSave}`,
  category: 'hitl_learning',
  subcategory: escalation.employees?.policy_type || 'general',
  metadata: {
    escalation_id: escalationId,
    resolved_by: ctx.from.username || ctx.from.first_name,
    employee_policy: escalation.employees?.policy_type,
    source_type: isCorrectCommand ? 'ai_confirmed' : 'human_provided'
  },
  source: 'hitl_learning'
});

// Mark as added to KB
await supabase
  .from('escalations')
  .update({ was_added_to_kb: true })
  .eq('id', escalationId);

// Mark chat message as resolved
await supabase
  .from('chat_history')
  .update({ escalation_resolved: true })
  .eq('id', escalation.message_id);
```

---

## Commands Reference

### `/start`

**File:** `backend/api/services/telegram.js:78-88`

Shows welcome message and basic instructions:
- Purpose of the bot
- How to respond to escalations
- Available commands

### `/help`

**File:** `backend/api/services/telegram.js:91-110`

Displays detailed help:
1. How to read escalation notifications
2. Three response options (correct/custom/skip)
3. What happens after responding
4. Links to other commands

### `/pending`

**File:** `backend/api/services/telegram.js:113-148`

Lists pending escalations:
- Shows up to 10 pending escalations
- Displays: escalation ID, employee name, question preview, timestamp
- Sorted by most recent first

```javascript
const { data: escalations } = await supabase
  .from('escalations')
  .select('id, query, created_at, employees(name, policy_type)')
  .eq('status', 'pending')
  .order('created_at', { ascending: false })
  .limit(10);
```

### `/stats`

**File:** `backend/api/services/telegram.js:151-179`

Shows escalation statistics:
- Total escalations
- Pending count
- Resolved count
- Today's escalations

```javascript
const { data: stats } = await supabase
  .from('escalations')
  .select('status, created_at');

const total = stats.length;
const pending = stats.filter(s => s.status === 'pending').length;
const resolved = stats.filter(s => s.status === 'resolved').length;
const today = stats.filter(s => {
  const date = new Date(s.created_at);
  return date.toDateString() === new Date().toDateString();
}).length;
```

---

## Database Integration

### Escalations Table Schema

**File:** `backend/config/schema.sql`

```sql
CREATE TABLE escalations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  message_id UUID REFERENCES chat_history(id),
  employee_id UUID REFERENCES employees(id),
  query TEXT NOT NULL,
  context JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  resolution TEXT,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP WITH TIME ZONE,
  was_added_to_kb BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Context Field Structure

```json
{
  "reason": "no_knowledge_found | poor_knowledge_match | low_confidence",
  "aiResponse": "The AI's actual response to the user",
  "confidence": 0.45,
  "knowledgeMatch": {
    "hasKnowledge": false,
    "matchCount": 0,
    "avgSimilarity": 0,
    "bestMatch": null,
    "status": "no_knowledge | poor_match | partial_match | good_match"
  },
  "sources": [
    {
      "id": "uuid",
      "title": "Source title",
      "category": "policy",
      "similarity": 0.35
    }
  ],
  "employee": {
    "name": "John Doe",
    "policyType": "Premium"
  }
}
```

### Status Values

- `pending` - Awaiting human review
- `resolved` - Human provided resolution (added to KB)
- `skipped` - Reviewed but not added to KB

---

## Technical Implementation

### Dependencies

**File:** `backend/api/services/telegram.js:1-4`

```javascript
import { Telegraf } from 'telegraf';  // Telegram bot framework
import supabase from '../../config/supabase.js';  // Database client
import { addKnowledgeEntry } from './vectorDB.js';  // KB integration
import dotenv from 'dotenv';  // Environment variables
```

### Bot Instance Management

```javascript
let bot;

if (TELEGRAM_BOT_TOKEN) {
  bot = new Telegraf(TELEGRAM_BOT_TOKEN);
  console.log('✓ Telegram bot initialized');
} else {
  console.warn('⚠ TELEGRAM_BOT_TOKEN not set - HITL features disabled');
}
```

### Graceful Shutdown

**File:** `backend/api/services/telegram.js:352-353`

```javascript
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

### Error Handling

All async operations include try-catch blocks:

```javascript
try {
  // Operation
  await supabase.from('escalations').update(...);
  ctx.reply('✅ Success');
} catch (error) {
  console.error('Error:', error);
  ctx.reply('❌ Error processing request');
}
```

---

## Workflow Diagram

### Complete Escalation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER SENDS MESSAGE                       │
└─────────────────────────┬───────────────────────────────────────┘
                          ↓
                  ┌───────────────┐
                  │ Knowledge Base│
                  │    Search     │
                  └───────┬───────┘
                          ↓
                  ┌───────────────┐
                  │  AI Response  │
                  │  Generation   │
                  └───────┬───────┘
                          ↓
            ┌─────────────────────────┐
            │ Calculate Confidence &  │
            │   Knowledge Match       │
            └─────────┬───────────────┘
                      ↓
            ┌─────────────────────────┐
            │   Escalation Check      │
            │                         │
            │ No Knowledge Found? ────────┐
            └─────────┬───────────────┘   │
                      ↓                    │
                 Send Response             │
                 to User                   │
                                           │
            YES ←──────────────────────────┘
             ↓
     ┌───────────────┐
     │   Create      │
     │  Escalation   │
     │   Record      │
     └───────┬───────┘
             ↓
     ┌───────────────┐
     │    Extract    │
     │    Contact    │
     │  Information  │
     └───────┬───────┘
             ↓
     ┌───────────────┐
     │    Send to    │
     │   Telegram    │
     └───────┬───────┘
             ↓
     ┌───────────────────────┐
     │  HUMAN REVIEWS IN     │
     │  TELEGRAM GROUP       │
     └───────┬───────────────┘
             ↓
     ┌───────────────────────┐
     │  Human Replies:       │
     │  1. "correct"         │
     │  2. Custom answer     │
     │  3. "skip"            │
     └───────┬───────────────┘
             ↓
     ┌───────────────────────┐
     │  Update Escalation    │
     │  Status               │
     └───────┬───────────────┘
             ↓
        Skip? ─────YES───→ Mark as
             │            reviewed
             NO
             ↓
     ┌───────────────────────┐
     │  Add to Knowledge     │
     │  Base                 │
     │  - AI confirmed or    │
     │  - Human provided     │
     └───────┬───────────────┘
             ↓
     ┌───────────────────────┐
     │  Mark as Resolved     │
     │  - was_added_to_kb    │
     │  - escalation_resolved│
     └───────────────────────┘

            NO ←───────────────────────┘
             ↓
        Continue Normal Flow
```

---

## Configuration Examples

### Default Setup (Only Option)

```bash
# Only escalate when no knowledge found
ESCALATE_ON_NO_KNOWLEDGE=true
```

**Behavior:**
- Escalates ONLY when vector search returns no results
- `knowledgeMatch.status = 'no_knowledge'`
- Focuses exclusively on knowledge gaps
- AI handles all cases where it has any relevant information

---

## Troubleshooting

### Bot Not Starting

**Issue:** Bot doesn't initialize

**Check:**
1. `TELEGRAM_BOT_TOKEN` is set in `.env`
2. Token is valid (test with BotFather)
3. Check server logs for errors

### Messages Not Received

**Issue:** Escalations not appearing in Telegram

**Check:**
1. `TELEGRAM_CHAT_ID` is correct
2. Bot is added to the group
3. Bot has permission to send messages
4. Check server logs for sending errors

### Responses Not Working

**Issue:** Replying to escalations doesn't work

**Check:**
1. Replying to the correct message (not forwarding)
2. Escalation ID present in message
3. Escalation status is "pending"
4. Database connectivity
5. Check bot logs for errors

### Contact Info Not Extracted

**Issue:** Contact information not showing

**Check:**
1. User provided email/phone in chat
2. Format matches regex patterns
3. Phone numbers 8-15 digits
4. Recent messages (last 20) included

---

## Best Practices

### For Operators

1. **Respond Promptly:** Bot learns faster with quick responses
2. **Use "Correct" Wisely:** Save time when AI is actually right
3. **Be Specific:** Clear answers improve future AI performance
4. **Skip One-Offs:** Don't add unique personal questions to KB
5. **Monitor Patterns:** Frequent escalations indicate KB gaps

### For Administrators

1. **Monitor Escalation Volume:** Adjust thresholds if too many/few
2. **Review KB Quality:** Ensure added knowledge is accurate
3. **Analyze Reasons:** Track which escalation reasons are most common
4. **Update Thresholds:** Fine-tune similarity and confidence values
5. **Train Team:** Ensure operators understand response options

---

## Security Considerations

1. **Token Protection:**
   - Never commit `.env` file
   - Rotate bot token if exposed
   - Use environment variables

2. **Access Control:**
   - Restrict Telegram group membership
   - Monitor who can respond to escalations
   - Track `resolved_by` for accountability

3. **Data Privacy:**
   - Employee data visible in Telegram
   - Ensure group is private
   - Consider compliance requirements (HIPAA, GDPR)

4. **Message Validation:**
   - Verify escalation IDs before processing
   - Check escalation status (prevent duplicate responses)
   - Validate message source

---

## Future Enhancements

### Potential Improvements

1. **Batch Review Interface:**
   - Handle multiple escalations at once
   - Bulk actions for similar queries

2. **Auto-Resolution:**
   - Re-evaluate confidence after KB updates
   - Auto-resolve if new knowledge added

3. **Analytics Dashboard:**
   - Escalation patterns and trends
   - Knowledge gap analysis
   - Operator performance metrics

4. **Smart Routing:**
   - Route to specific experts by policy type
   - Priority-based escalation
   - SLA tracking

5. **Integration:**
   - Ticketing systems (Jira, ServiceNow)
   - Slack/Teams support
   - Email notifications

---

## Summary

The Telegram workflow provides a robust Human-in-the-Loop system that:

✅ **Detects Knowledge Gaps:** Intelligently identifies when AI lacks information
✅ **Notifies Humans:** Sends detailed context to Telegram for review
✅ **Extracts Contact Info:** Automatically finds user contact details from conversation
✅ **Handles Responses:** Three flexible response options (correct/custom/skip)
✅ **Learns Continuously:** Adds human knowledge back to the system
✅ **Tracks Everything:** Complete audit trail in database

The system ensures the chatbot continuously improves through human feedback while maintaining high-quality responses to users.
