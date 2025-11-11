# Knowledge Base Diagnostic Tools

## Problem: Knowledge Search Returns 0 Results

When you see logs like:
```
[Knowledge Search] Query: "Why is my claim up to $60 only?"
[Knowledge Search] Found 0 matching contexts
[Knowledge Search] No contexts found - AI will likely escalate
```

This usually means one of these issues:

### Issue 1: Missing Embeddings ❌
**Most Common Issue**: Knowledge base entries exist but don't have embeddings (embeddings are NULL).

**How to Check**:
```bash
node backend/scripts/check-knowledge-embeddings.js company_a
```

**Expected Output if Problem Exists**:
```
❌ ISSUE FOUND: No active entries have embeddings!
   This explains why searches return 0 results.
```

**Solution**: Re-embed the knowledge base
- **Option 1 (Web UI)**: Go to `http://your-domain/reembed.html`
  - Select schema: `company_a`
  - Click "Start Re-embedding"

- **Option 2 (Command Line)**:
  ```bash
  node backend/migrations/re-embed-knowledge-with-titles.js --schema=company_a
  ```

### Issue 2: match_knowledge Function Missing
The database function `match_knowledge` doesn't exist in the schema.

**How to Check**: The diagnostic script above will show:
```
❌ Function "match_knowledge" does not exist in schema "company_a"!
```

**Solution**: Apply the schema template
1. Go to `backend/config/company-schema-template.sql`
2. Find the `match_knowledge` function (lines 227-254)
3. Run the SQL in your database for the company schema

### Issue 3: No Knowledge Base Data
The knowledge base is empty.

**How to Check**: Diagnostic shows:
```
📊 Knowledge Base Statistics:
   Total entries: 0
```

**Solution**: Import knowledge base data through admin panel

### Issue 4: Embeddings with Wrong Dimensions
Embeddings exist but have wrong dimensions (not 1536 for text-embedding-ada-002).

**How to Check**: Diagnostic shows:
```
Has Embedding: ✅ YES (3072 dims)  # Wrong! Should be 1536
```

**Solution**: Re-embed with correct model settings

## Running Diagnostics on Render

Since you can't run node scripts directly on Render, you have two options:

### Option 1: Use Render Shell
1. Go to Render Dashboard
2. Select your service
3. Click "Shell" tab
4. Run: `node backend/scripts/check-knowledge-embeddings.js company_a`

### Option 2: Check via Web Interface
1. Deploy the changes (already done with latest push)
2. Go to: `http://your-domain/reembed.html`
3. The interface will show embedding statistics

## Common Scenarios

### Scenario 1: Fresh Database
- Knowledge base entries imported ✅
- Embeddings = NULL ❌
- **Fix**: Run re-embedding

### Scenario 2: After Migration
- Old embeddings might be stale
- May not include titles in embeddings
- **Fix**: Run re-embedding with title inclusion

### Scenario 3: Model Change
- Changed from ada-002 to ada-003
- Dimension mismatch
- **Fix**: Update model settings + re-embed

## Quick Diagnostic Checklist

Run through these checks:

1. ✅ Schema exists?
2. ✅ knowledge_base table exists?
3. ✅ Entries in knowledge_base > 0?
4. ✅ Active entries > 0?
5. ✅ Embeddings not NULL?
6. ✅ Embedding dimensions = 1536?
7. ✅ match_knowledge function exists?
8. ✅ Similarity threshold reasonable (0.7)?

If all ✅, search should work!

## Testing After Fix

After re-embedding, test with:
```bash
# In Render shell or local
curl -X POST http://your-domain/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session",
    "message": "Why is my claim up to $60 only?",
    "domain": "company-a-domain.com"
  }'
```

Check logs for:
```
[Knowledge Search] Found 3 matching contexts  # Should be > 0
```
