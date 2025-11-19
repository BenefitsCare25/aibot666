# Custom Prompt Issue - Complete Analysis and Solution

**Date:** 2025-11-18
**Issue:** Bot generates own answers instead of using knowledge base answers
**Status:** Root cause identified, solution provided

---

## What's Being Sent to OpenAI

Your system prompt is constructed in **3 layers**:

```
Layer 1: Your Custom Prompt (from database)
   ↓
Layer 2: Variable Injection ({{CONTEXT}}, {{EMPLOYEE_INFO}}, etc.)
   ↓
Layer 3: Conversation Context Awareness (auto-appended)
   ↓
FINAL PROMPT → Sent to OpenAI
```

### Example: Complete Final Prompt

**Your custom prompt** (1205 chars) says:
```
2. CONTEXT USAGE PRIORITY: If context is provided from the knowledge base,
   USE IT to answer and strictly not answer your own replies that is
   irrelevant to the knowledge based
```

**After variable injection** (1221 chars), it becomes:
```
Knowledge based: [Context 1]
Question: How Can I change my phone number For the OTP?
Category: Procedures
Similarity: 0.7918
Answer: Please be advised to email to us at helpdesk@inpro.com.sg with
        your new contact details for us to update.
```

**After context awareness injection** (2442 chars total):
```
[Everything above]
+
CRITICAL: CONVERSATION CONTEXT AWARENESS - ALWAYS APPLY THIS:
- ALWAYS review the conversation history BEFORE responding
- Check what YOUR PREVIOUS MESSAGE said...
[Additional 1221 characters of context awareness instructions]
```

---

## The Problem

Your custom prompt instruction is **too vague**:

❌ **What it says:**
> "USE IT to answer and strictly not answer your own replies that is irrelevant to the knowledge based"

❌ **Why it fails:**
1. "USE IT" - what is "IT"? Not specific
2. "irrelevant to the knowledge based" - grammatically unclear, confusing meaning
3. Doesn't explicitly tell AI to use the "Answer:" field verbatim
4. AI interprets this as "use it as reference" not "copy it exactly"

✅ **What it SHOULD say:**
> "The 'Answer:' field contains the EXACT text you MUST provide - copy it directly"

---

## The Evidence

**Question asked:** "How Can I change my phone number For the OTP?"

**Knowledge base has:**
```
Answer: Please be advised to email to us at helpdesk@inpro.com.sg with
        your new contact details for us to update.
```

**What AI responded:**
```
To change your phone number for receiving OTPs, you will need to update
your contact information in the system. Here's how you can do it:
1. Log in to your account: Access the portal or system where...
```

**Why:** AI generated its own answer because your prompt didn't explicitly say to use the Answer field text.

---

## The Solution

### Option 1: Update Custom Prompt in Database (Recommended)

Update your `ai_settings.system_prompt` in the database to:

```
You are an AI chat bot. Your role is to address user enquiries based on the knowledge base.

IMPORTANT INSTRUCTIONS:
1. Answer based on the provided context from knowledge base and employee information

2. CONTEXT USAGE PRIORITY - FOLLOW THESE RULES EXACTLY:
   a) Each context entry has a "Question:" and an "Answer:" field
   b) The "Answer:" field contains the EXACT text you MUST provide to the user
   c) Copy the Answer field text directly - do NOT generate your own response
   d) You may rephrase slightly for politeness, but NEVER change the instructions or contact details
   e) If Answer says "email to helpdesk@inpro.com.sg", you MUST include that exact email
   f) If Answer says "login to portal", you MUST tell user to login to portal
   g) DO NOT add extra steps, suggestions, or alternative solutions not in the Answer field

3. ONLY escalate if NO context is provided AND you cannot answer from employee information

4. When escalating, say: "For such query, let us check back with the team. You may leave your contact or email address for our team to follow up with you. Thank you."

5. Use clear, professional, and empathetic language

CRITICAL DATA PRIVACY RULES:
- NEVER provide information about OTHER employees
- You can ONLY discuss the logged-in employee's own information
- NEVER search the web or external sources for employee data
- NEVER hallucinate or guess information not explicitly provided in the context

FORMATTING GUIDELINES:
- Use clean, readable formatting with markdown
- Use bullet points (using -) for lists instead of asterisks
- Keep paragraphs short and concise

Answer based on context with similarity >{{SIMILARITY_THRESHOLD}}.

User asked: {{QUERY}}

Knowledge base contexts (use the Answer field directly):
{{CONTEXT}}

Employee info: {{EMPLOYEE_INFO}}
```

**Key changes in Section 2:**
- ✅ "The 'Answer:' field contains the EXACT text you MUST provide"
- ✅ "Copy the Answer field text directly - do NOT generate your own response"
- ✅ "NEVER change the instructions or contact details"
- ✅ "DO NOT add extra steps, suggestions, or alternative solutions"

### Option 2: Remove Custom Prompt

Delete the custom prompt from database and use the default prompt (which already has proper instructions after my fixes).

---

## How to Update Database

### Using Supabase Dashboard:
1. Go to Supabase Dashboard
2. Navigate to: Table Editor → `cbre` schema → `companies` table
3. Find the CBRE company record
4. Edit the `ai_settings` column (JSONB field)
5. Update the `system_prompt` value
6. Save changes

### Using SQL:
```sql
UPDATE cbre.companies
SET ai_settings = jsonb_set(
  ai_settings,
  '{system_prompt}',
  '"[PASTE THE IMPROVED PROMPT HERE]"'
)
WHERE id = '[YOUR_COMPANY_ID]';
```

---

## How to Debug (Optional)

If you want to see the EXACT prompt sent to OpenAI in your logs:

1. Add environment variable to Render:
   ```
   LOG_FULL_PROMPTS=true
   ```

2. Redeploy

3. Check logs - you'll see:
   ```
   ================================================================================
   [RAG] COMPLETE SYSTEM PROMPT SENT TO OPENAI:
   ================================================================================
   [Full prompt here with all 2442 characters]
   ================================================================================
   ```

**Warning:** This will make logs very verbose. Only enable for debugging.

---

## Files Created

1. `EXACT_OPENAI_PROMPT_BREAKDOWN.md` - Complete step-by-step breakdown
2. `IMPROVED_CUSTOM_PROMPT.md` - Ready-to-use improved prompt template
3. `PROMPT_ISSUE_SUMMARY_2025-11-18.md` - This file (executive summary)

---

## Next Steps

1. ✅ Update custom prompt in database (use improved version)
2. ✅ Test with the same question: "How Can I change my phone number For the OTP?"
3. ✅ Verify bot responds: "Please be advised to email to us at helpdesk@inpro.com.sg..."
4. ✅ Test other knowledge base entries to confirm fix works across the board

---

## Technical Details

- Prompt construction: `openai.js` lines 254-316
- Variable injection: `openai.js` lines 107-163
- Context awareness: `openai.js` lines 77-99
- Default prompt: `openai.js` lines 173-243

The conversation context awareness is automatically appended to ALL prompts (custom or default) to handle escalation follow-ups properly.
