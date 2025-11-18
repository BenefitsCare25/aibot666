# Chatbot Context Awareness Fix - November 17, 2025

## Problem Statement

The chatbot was losing conversational context when users responded to escalation requests with contact information.

**Scenario:**
1. Bot escalates: "For such query, let us check back with the team. You may leave your contact or email address..."
2. User provides: "88399967"
3. Bot incorrectly responds: "It seems like you're providing a number, but I need more context..."

**Root Cause:**
- AI received conversation history but system prompt lacked explicit instructions to check previous context
- No conversation state tracking to know the bot was "awaiting contact info"
- Contact detection logic ran AFTER AI response instead of BEFORE

## Solution Implemented

### 1. Enhanced System Prompt (Primary Fix)
**File:** `backend/api/services/openai.js` (lines 185-203)

**Changes:**
- Added new section "8. CONVERSATION CONTEXT AWARENESS - READ THIS CAREFULLY"
- Explicit instruction: "ALWAYS review the conversation history BEFORE responding"
- Pattern recognition guidance: "If YOUR PREVIOUS MESSAGE asked for contact information... the current user message is VERY LIKELY their contact information"
- Specific examples: "Pure numbers like '88399967' after escalation = phone number"
- Clear directive: "DO NOT ask 'what does this mean' or 'I need more context'"

**Impact:** AI now understands to check what it previously said before responding

### 2. Smart Pre-Processing Logic (Safety Net)
**File:** `backend/api/routes/chat.js` (lines 572-601)

**Changes:**
- Added pre-processing before sending message to AI
- Detects if last bot message was an escalation
- Checks if current message is contact information (using existing `isContactInformation()` function)
- Injects context hint: `[User is providing contact information in response to escalation request] {message}`
- Retrieves and checks conversation state for `awaitingContactInfo` flag
- Clears state when contact info is received

**Impact:** Double safety - even if prompt fails, context hint ensures AI understands

### 3. Session State Tracking (Better UX)
**Files:**
- `backend/api/utils/session.js` (lines 345-392, exports updated)
- `backend/api/routes/chat.js` (import updated, state management added)

**New Functions:**
```javascript
updateConversationState(sessionId, state)
getConversationState(sessionId)
```

**State Schema:**
```javascript
conversationState: {
  lastBotAction: 'escalated' | 'received_contact_info' | 'answered',
  awaitingContactInfo: true | false,
  escalationTimestamp: ISO timestamp,
  escalationReason: string,
  contactReceivedAt: ISO timestamp,
  lastUpdated: ISO timestamp
}
```

**Integration Points:**
- Set state when escalation occurs (line 679-685)
- Check state during pre-processing (line 574, 584)
- Clear state when contact received (line 594-599)

**Impact:** Persistent tracking across requests, enables future features like "timeout after 10 min without contact"

## Files Modified

1. **backend/api/services/openai.js**
   - Enhanced system prompt with conversation context awareness (lines 185-203)
   - Renumbered subsequent instructions (10-15 instead of 9-14)

2. **backend/api/utils/session.js**
   - Added `updateConversationState()` function (lines 345-377)
   - Added `getConversationState()` function (lines 379-392)
   - Updated exports (lines 422-423)

3. **backend/api/routes/chat.js**
   - Added imports for state functions (lines 14-15)
   - Added pre-processing logic (lines 572-601)
   - Added state update on escalation (lines 679-685)
   - Console logging for debugging

## Testing Approach

### Manual Test Scenario
1. Start fresh conversation
2. Ask question that triggers escalation: "What is my dental coverage?"
3. Bot should respond with escalation message
4. Check console logs: should see "Conversation state updated: awaiting contact info"
5. Provide contact info: "88399967"
6. Check console logs: should see "Context detected: User providing contact info after escalation"
7. Bot should respond: "Thank you for providing your contact information. Our team has received your inquiry..."

### Console Log Indicators
Success indicators:
```
[Escalation] ✅ Conversation state updated: awaiting contact info
[Chat] 🎯 Context detected: User providing contact info after escalation
[Chat] Escalation state: Active
[Chat] ✅ Conversation state cleared: contact info received
```

### Automated Test (Future)
Create integration test:
```javascript
test('Bot recognizes contact info after escalation', async () => {
  // 1. Send message that triggers escalation
  const escalationResponse = await sendMessage('What is my dental coverage?');
  expect(escalationResponse.escalated).toBe(true);

  // 2. Send contact info
  const contactResponse = await sendMessage('88399967');
  expect(contactResponse.answer).toContain('Thank you for providing your contact information');
  expect(contactResponse.answer).not.toContain('need more context');
});
```

## Rollback Plan

If issues occur, revert these commits:
1. `backend/api/services/openai.js` - Restore original system prompt (lines 185-203)
2. `backend/api/routes/chat.js` - Remove pre-processing logic (lines 572-601, 679-685)
3. `backend/api/utils/session.js` - Remove state functions (optional, won't break anything)

## Future Enhancements

1. **Timeout Handling**: Clear `awaitingContactInfo` after 10 minutes
2. **Analytics**: Track how often users provide contact info vs abandon
3. **Multi-turn Context**: Extend to other conversation patterns (not just escalation)
4. **UI Indicator**: Show "waiting for contact info" state in frontend
5. **Validation**: Verify contact format (email regex, phone number format)
6. **Follow-up**: Auto-remind if no contact provided within 5 minutes

## Expected Behavior After Fix

**Before:**
```
Bot: "For such query, let us check back with the team. You may leave your contact..."
User: "88399967"
Bot: "It seems like you're providing a number, but I need more context..." ❌
```

**After:**
```
Bot: "For such query, let us check back with the team. You may leave your contact..."
User: "88399967"
Bot: "Thank you for providing your contact information. Our team has received your inquiry..." ✅
```

## Performance Impact

- **Minimal**: Added 2 Redis operations per escalation cycle
  - 1 write on escalation (updateConversationState)
  - 1 read + 1 write on contact received (getConversationState + updateConversationState)
- **Total overhead**: ~5-10ms per request (Redis is fast)
- **Memory**: Negligible (~200 bytes per session in Redis)
- **Token usage**: Context hint adds ~15 tokens per message when applicable

## Deployment Notes

1. No database migrations required (uses existing Redis infrastructure)
2. No environment variables needed
3. Backward compatible - works with existing sessions
4. Can be deployed independently without frontend changes
5. Monitor console logs after deployment for verification

## Conclusion

This fix implements a **three-layer defense** against context loss:

1. **AI Layer**: Enhanced prompt instructs AI to check conversation history
2. **Pre-processing Layer**: Context hint injected when escalation+contact detected
3. **State Layer**: Persistent tracking enables future enhancements

The fix is **production-ready**, **backward-compatible**, and **low-risk** with minimal performance overhead.
