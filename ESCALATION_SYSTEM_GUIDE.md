# Escalation System Guide

## Overview

The escalation system has been enhanced to provide more intelligent triggering and better context for human reviewers. Instead of relying solely on confidence scores, the system now detects when the AI truly lacks knowledge to answer questions.

## What Changed

### 1. **Smart Escalation Triggers**

**Before:** Escalated based on confidence score (<70%)
- Problem: Confidence is ambiguous - could mean "no knowledge" or "uncertain answer"

**After:** Two-tier escalation system (configurable):
- **Tier 1 (Default):** No knowledge found in database
  - Triggers when RAG search finds no relevant contexts
  - Or when all contexts have very low similarity (<40%)
- **Tier 2 (Optional):** Low confidence response
  - Can be enabled if you want to review uncertain answers
  - Disabled by default

### 2. **Enhanced Telegram Notifications**

**New Message Format:**
```
🔔 New Escalation

Employee: Jane Smith
Policy: Standard | Coverage: $50000

Question:
Hi what my limit

🤖 AI Response:
Hello Jane, Your insurance policy, the Standard plan,
has the following limits for the policy period from
January 1, 2024, to December 31, 2024:
- Overall Coverage Limit: $50,000
- Annual Claim Limit: $25,000
[...]

📊 Status: ❌ No Knowledge Base Match
Knowledge Sources: None found

[Escalation: 9bf1084b-86eb-4d97-bd76-946f831cca75]

✅ Reply "correct" if AI response is good
📝 Reply with better answer to teach the bot
⏭️ Reply "skip" to mark as reviewed
```

**What's Included:**
- ✅ Employee's question
- ✅ AI's actual response (what the user saw)
- ✅ Clear escalation reason (not just confidence %)
- ✅ Knowledge source status (how many matches, relevance)
- ✅ Action instructions

### 3. **Smart Response Handling**

You now have **three ways** to respond to escalations:

#### Option 1: Confirm AI Response
```
Reply: "correct"
```
- Use when AI's answer is actually correct
- Saves AI's response to knowledge base
- Bot learns the question is answerable with existing knowledge

#### Option 2: Provide Better Answer
```
Reply: "Your detailed answer here..."
```
- Use when AI's answer needs improvement
- Your answer replaces AI's response in knowledge base
- Bot learns the correct way to answer this question

#### Option 3: Skip (Don't Add to Knowledge Base)
```
Reply: "skip"
```
- Use when the question is too specific/one-off
- Marks as reviewed but doesn't teach the bot
- Good for unique personal questions

## Configuration

### Environment Variables (.env)

```bash
# Escalation Configuration (new)
ESCALATE_ON_NO_KNOWLEDGE=true     # Trigger when no KB match (recommended)
ESCALATE_ON_LOW_CONFIDENCE=false  # Trigger on low confidence (optional)
MIN_KNOWLEDGE_SIMILARITY=0.4      # Minimum relevance threshold (0-1)

# Existing Configuration
CONFIDENCE_THRESHOLD=0.7           # Used if ESCALATE_ON_LOW_CONFIDENCE=true
VECTOR_SIMILARITY_THRESHOLD=0.7   # RAG search threshold
```

### Recommended Settings

**Default (No Knowledge Only):**
```bash
ESCALATE_ON_NO_KNOWLEDGE=true
ESCALATE_ON_LOW_CONFIDENCE=false
MIN_KNOWLEDGE_SIMILARITY=0.4
```

**Strict (Review Everything Uncertain):**
```bash
ESCALATE_ON_NO_KNOWLEDGE=true
ESCALATE_ON_LOW_CONFIDENCE=true
MIN_KNOWLEDGE_SIMILARITY=0.5
CONFIDENCE_THRESHOLD=0.8
```

**Minimal (Only Critical Gaps):**
```bash
ESCALATE_ON_NO_KNOWLEDGE=true
ESCALATE_ON_LOW_CONFIDENCE=false
MIN_KNOWLEDGE_SIMILARITY=0.3
```

## Escalation Reasons Explained

### ❌ No Knowledge Base Match
- RAG search returned no results
- Bot has zero relevant information
- Most critical - needs human answer

### ⚠️ Poor Knowledge Match
- RAG found some results but below threshold
- Similarity <40% (not relevant enough)
- Bot might hallucinate, needs verification

### 🤔 Low Confidence Response
- Bot found knowledge but unsure about answer
- Contains uncertainty phrases ("I'm not sure...")
- Only triggers if `ESCALATE_ON_LOW_CONFIDENCE=true`

## Technical Details

### Files Modified

1. **backend/.env.example** - New configuration variables
2. **backend/api/services/openai.js** - Knowledge match detection
3. **backend/api/routes/chat.js** - Smart escalation logic
4. **backend/api/services/telegram.js** - Enhanced notifications & response handling

### Knowledge Match Detection

The system now calculates:
- `hasKnowledge`: Boolean - found relevant contexts?
- `matchCount`: Number - how many relevant sources
- `avgSimilarity`: Average relevance score (0-1)
- `bestMatch`: Highest relevance score
- `status`: 'no_knowledge' | 'poor_match' | 'partial_match' | 'good_match'

### Database Schema

Escalations now include in `context` field:
```json
{
  "reason": "no_knowledge_found",
  "aiResponse": "The AI's actual response",
  "confidence": 0.45,
  "knowledgeMatch": {
    "hasKnowledge": false,
    "matchCount": 0,
    "avgSimilarity": 0,
    "bestMatch": null,
    "status": "no_knowledge"
  },
  "sources": [...],
  "employee": {...}
}
```

## Testing the System

1. **Test No Knowledge Escalation:**
   - Ask a question not in knowledge base
   - Should trigger escalation immediately
   - Check Telegram for full details

2. **Test "Correct" Response:**
   - Reply "correct" to escalation
   - Verify AI response added to KB
   - Try asking same question - should work now

3. **Test Custom Answer:**
   - Reply with your own answer
   - Verify your answer added to KB
   - Test if bot uses your answer for similar questions

4. **Test Skip:**
   - Reply "skip"
   - Verify marked as reviewed
   - Confirm NOT added to knowledge base

## Migration Notes

**Existing Escalations:**
- Old escalations use confidence-based triggering
- New escalations use knowledge-match detection
- Both systems compatible (no breaking changes)

**Backward Compatibility:**
- If env vars not set, falls back to confidence-based
- Existing Telegram message handlers still work
- No database schema changes required

## Best Practices

1. **Review Escalations Promptly:**
   - Bot learns faster with quick responses
   - Users get better answers immediately

2. **Use "Correct" When Appropriate:**
   - Saves time if AI got it right
   - Builds confidence in the system

3. **Be Specific in Custom Answers:**
   - Clear answers improve future responses
   - Include policy numbers, limits, procedures

4. **Skip One-Off Questions:**
   - Personal/unique situations
   - Time-sensitive queries
   - Questions requiring human judgment

5. **Monitor Knowledge Sources:**
   - Check if escalations show "partial match"
   - Might indicate gaps in knowledge base
   - Consider adding comprehensive docs

## Troubleshooting

**Too Many Escalations:**
- Lower `MIN_KNOWLEDGE_SIMILARITY` (e.g., 0.3)
- Ensure knowledge base is comprehensive
- Check if similar questions already answered

**Too Few Escalations:**
- Raise `MIN_KNOWLEDGE_SIMILARITY` (e.g., 0.5)
- Enable `ESCALATE_ON_LOW_CONFIDENCE=true`
- Review confidence threshold setting

**AI Response Not Showing:**
- Check escalation `context.aiResponse` field
- Verify OpenAI API generating responses
- Check Telegram message formatting

**"Correct" Not Working:**
- Ensure replying to escalation message
- Check escalation status (must be "pending")
- Verify AI response exists in context

## Support

For issues or questions:
1. Check server logs for error messages
2. Verify environment variables set correctly
3. Test Telegram bot connection
4. Review escalation records in database

## Future Enhancements

Potential improvements:
- Auto-resolve if confidence improves over time
- Batch escalation review interface
- Analytics dashboard for escalation patterns
- Smart routing based on policy type
- Integration with ticketing systems
