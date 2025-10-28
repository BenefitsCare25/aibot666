# FAQ Knowledge Base Setup Guide

## What We've Done

### 1. Updated QuickQuestions Component with Instant Q&A ✅
**Files:**
- `frontend/widget/src/components/QuickQuestions.jsx`
- `frontend/widget/src/components/ChatWindow.jsx`

**NEW FEATURE: Instant Q&A Responses** ⚡

The chatbot now includes **pre-loaded answers** that display INSTANTLY when users click quick questions - no API calls, no waiting, no knowledge base required!

The chatbot UI displays all 27 Q&A pairs from your Excel file organized into 4 sections:
- **Benefit Coverage** - 15 Q&A pairs
- **Letter of Guarantee (LOG)** - 1 Q&A pair
- **Portal Matters** - 8 Q&A pairs
- **Claims Status** - 3 Q&A pairs

### 2. Created Knowledge Base Population Scripts ✅

**Files Created:**
- `backend/scripts/populate-faq-knowledge-base.js` - Automated script with OpenAI embeddings
- `backend/scripts/insert-faq-knowledge.sql` - Manual SQL insertion script
- `faq_sections.json` - Parsed FAQ data from your Excel file

## How the Instant Q&A Feature Works

### User Experience Flow

1. **User clicks chat button** → Opens chatbot widget
2. **User clicks question mark icon (?)** → Shows Quick Questions panel
3. **User expands a category** → Sees all questions in that section
4. **User clicks a question** → Answer appears INSTANTLY in chat (no loading!)
5. **User can ask follow-ups** → Types custom questions that go through AI

### Technical Implementation

**Data Structure:**
```javascript
{
  q: "How do I check how much balance I have left?",
  a: "Kindly drop us a message in the portal..."
}
```

**What Happens When a Question is Clicked:**
1. ChatWindow receives Q&A object `{q, a}`
2. Adds user message with question (q) to chat
3. Immediately adds assistant message with answer (a)
4. No API call, no embedding search, no AI processing
5. Result: Instant response (<50ms)

### Benefits

✅ **Lightning Fast** - Answers appear in <50ms
✅ **Works Offline** - No backend required for FAQ answers
✅ **No Costs** - Saves OpenAI API calls for common questions
✅ **Predictable** - Same question = same answer every time
✅ **Better UX** - Users get immediate help
✅ **Hybrid Mode** - Typed questions still use AI for flexibility

## Next Steps to Complete Setup

### Option 1: Automated Population (Recommended) - OPTIONAL

**Note:** The instant Q&A feature works WITHOUT populating the knowledge base! You only need to populate the knowledge base if you want:
- Typed questions (not from Quick Questions) to find these answers
- AI to reference these FAQs in dynamic responses
- Semantic search across FAQ content

This method generates vector embeddings for better AI matching.

1. **Ensure environment variables are set** in `backend/.env`:
   ```env
   OPENAI_API_KEY=your_openai_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_service_key
   ```

2. **Run the population script**:
   ```bash
   cd backend
   node scripts/populate-faq-knowledge-base.js company_a
   ```

   Replace `company_a` with your actual schema name.

3. **Script will**:
   - Read all Q&A pairs from `faq_sections.json`
   - Generate OpenAI embeddings for semantic search
   - Insert into `knowledge_base` table with proper categorization
   - Display progress and summary

### Option 2: Manual SQL Insertion

If you prefer to insert without embeddings initially (embeddings can be added later):

1. **Open the SQL file**: `backend/scripts/insert-faq-knowledge.sql`

2. **Replace placeholders**:
   - Change `{{SCHEMA_NAME}}` to your schema (e.g., `company_a`)

3. **Execute in Supabase**:
   - Go to Supabase Dashboard → SQL Editor
   - Paste the modified SQL
   - Run the script

**Note**: Without embeddings, the RAG system will need to be updated to handle null embeddings or you'll need to generate embeddings later.

## Testing the Chatbot

Once the knowledge base is populated:

1. **Start the backend**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the widget**:
   ```bash
   cd frontend/widget
   npm run dev
   ```

3. **Test questions**:
   - Click on any quick question
   - Verify the AI retrieves the correct answer
   - Check that answers match what's in your Excel file

## Summary of Changes

### Frontend Changes
| File | Change | Lines |
|------|--------|-------|
| `QuickQuestions.jsx` | Updated QUICK_QUESTIONS array | 3-75 |

### Backend Scripts
| File | Purpose |
|------|---------|
| `populate-faq-knowledge-base.js` | Automated insertion with embeddings |
| `insert-faq-knowledge.sql` | Manual SQL insertion |

### Data Files
| File | Content |
|------|---------|
| `faq_sections.json` | Parsed FAQ from Excel (27 Q&A pairs) |

## Knowledge Base Structure

Each FAQ entry is stored with:
- **title**: The question text
- **content**: The answer text
- **category**: Main category (benefits, log, portal, claims)
- **subcategory**: Specific subcategory (coverage, requests, access, status)
- **embedding**: Vector for semantic search (1536 dimensions)
- **metadata**: Section name and question number
- **source**: "Helpdesk FAQ - CBRE"
- **confidence_score**: 1.0 (high confidence)

## FAQ Breakdown

### Benefit Coverage (benefits/coverage) - 15 items
Covers medical coverage, claims, referrals, surgical procedures, Medisave

### Letter of Guarantee (log/requests) - 1 item
LOG request process and requirements

### Portal Matters (portal/*) - 8 items
- **portal/claims_submission** - How to submit claims, consent statements
- **portal/access** - Login, password reset, OTP changes
- **portal/panel_lists** - GP and Specialist panel lists, payment issues

### Claims Status (claims/status) - 3 items
Reimbursement timing, payment status, flexible claims processing

## Troubleshooting

### Issue: Embeddings not generating
**Solution**: Ensure OPENAI_API_KEY is valid and has credits

### Issue: Schema not found
**Solution**: Verify schema exists in Supabase and matches the name used

### Issue: Answers not matching questions
**Solution**: Check that embeddings were generated correctly and RAG system is configured

## Additional Notes

- The question "I cannot log in, what is my User ID?" was skipped because it had no answer in the Excel file
- Some answers reference specific URLs (benefits.inspro.com.sg) and phone numbers (3129 3002)
- Answer #12 ("Why do I need to authorise my Medisave...") just says "Yes." - you may want to expand this
