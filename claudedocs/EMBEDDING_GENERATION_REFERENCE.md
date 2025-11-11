# Embedding Generation Reference

## Question: Do all data entry methods generate embeddings?

Quick Answer: **Mostly YES ✅**, but with **one exception ⚠️**

---

## Knowledge Base Operations

### ✅ Single Entry Creation (Add Entry Button)
**File**: `backend/api/services/vectorDB.js` → `addKnowledgeEntry()`

**Status**: **YES - Generates embeddings** ✅

```javascript
// Line 179-180
const embeddingText = title ? `${title}\n\n${content}` : content;
const embedding = await generateEmbedding(embeddingText);
```

**What it does**:
1. Takes title + content
2. Calls OpenAI API to generate 1536-dim vector
3. Inserts entry WITH embedding into `knowledge_base` table

**API Endpoint**: `POST /api/admin/knowledge`

---

### ✅ Excel Upload (AFTER FIX)
**File**: `backend/api/services/excelKnowledgeBase.js` → `importKnowledgeBaseFromExcel()`

**Status**: **YES - Generates embeddings** ✅ (after today's fix)

```javascript
// Line 106
const result = await addKnowledgeEntriesBatch(batch, schemaClient);
```

**What it does**:
1. Parses Excel file
2. Processes in batches of 20
3. Calls `addKnowledgeEntriesBatch()` which generates embeddings
4. Inserts entries WITH embeddings

**API Endpoint**: `POST /api/admin/knowledge/upload-excel`

**Important**:
- ✅ **After today's fix**: Generates embeddings
- ❌ **Before today's fix**: Did NOT generate (used SQL RPC instead)
- ⚠️ **Existing data**: Still has NULL embeddings until re-embedded

---

### ✅ Batch Import
**File**: `backend/api/services/vectorDB.js` → `addKnowledgeEntriesBatch()`

**Status**: **YES - Generates embeddings** ✅

```javascript
// Lines 222-226
const embeddingTexts = entries.map(e =>
  e.title ? `${e.title}\n\n${e.content}` : e.content
);
const embeddings = await generateEmbeddingsBatch(embeddingTexts);
```

**What it does**:
1. Takes array of entries
2. Batch calls OpenAI API (efficient)
3. Inserts all entries WITH embeddings

**API Endpoint**: `POST /api/admin/knowledge/batch`

---

### ✅ Update Entry
**File**: `backend/api/services/vectorDB.js` → `updateKnowledgeEntry()`

**Status**: **YES - Regenerates embeddings if content changes** ✅

```javascript
// Lines 268-281
if (updates.content || updates.title) {
  // Fetch current entry
  const title = updates.title !== undefined ? updates.title : currentEntry?.title;
  const content = updates.content !== undefined ? updates.content : currentEntry?.content;

  // Regenerate embedding
  const embeddingText = title ? `${title}\n\n${content}` : content;
  updates.embedding = await generateEmbedding(embeddingText);
}
```

**What it does**:
1. If title/content changes
2. Regenerates embedding with new text
3. Updates entry with new embedding

**API Endpoint**: `PUT /api/admin/knowledge/:id`

---

## Employee Operations

### ✅ Single Employee Creation
**File**: `backend/api/services/vectorDB.js` → `addEmployee()`

**Status**: **YES - Generates embeddings** ✅

```javascript
// Lines 351-373
const embeddingContent = `
  Employee: ${employeeData.name}
  Employee ID: ${employeeData.employee_id || 'N/A'}
  ...
`.trim();

const embedding = await generateEmbedding(embeddingContent);

await client.from('employee_embeddings').insert([{
  employee_id: employee.id,
  content: embeddingContent,
  embedding
}]);
```

**What it does**:
1. Creates employee record in `employees` table
2. Generates text summary of employee data
3. Calls OpenAI to generate embedding
4. Inserts into `employee_embeddings` table

**API Endpoint**: `POST /api/admin/employees`

---

### ✅ Excel Upload - New Employees
**File**: `backend/api/services/excel.js` → `importEmployeesFromExcel()` → calls `addEmployeesBatch()`

**Status**: **YES - Generates embeddings** ✅

```javascript
// Line 260 (excel.js)
const batchImported = await addEmployeesBatch(batch, supabaseClient);

// Lines 408-434 (vectorDB.js - addEmployeesBatch)
const embeddingContents = employees.map(emp => `
  Employee: ${emp.name}
  ...
`.trim());

const embeddings = await generateEmbeddingsBatch(embeddingContents);

await client.from('employee_embeddings').insert(employeeEmbeddings);
```

**What it does**:
1. Parses Excel file
2. Identifies new employees (not duplicates)
3. Inserts into `employees` table
4. Batch generates embeddings via OpenAI
5. Inserts into `employee_embeddings` table

**API Endpoint**: `POST /api/admin/employees/upload`

---

### ⚠️ Excel Upload - UPDATE Existing Employees
**File**: `backend/api/services/excel.js` → `importEmployeesFromExcel()`

**Status**: **NO - Does NOT update embeddings** ⚠️

```javascript
// Lines 275-291 (excel.js)
await supabaseClient
  .from('employees')
  .update({
    name: emp.name,
    email: emp.email,
    // ... other fields
  })
  .eq('employee_id', emp.employee_id);

// ❌ Does NOT update employee_embeddings table!
```

**What it does**:
1. When duplicate employee_id found
2. If `duplicateAction === 'update'`
3. Updates `employees` table ONLY
4. **Does NOT regenerate or update embeddings**

**API Endpoint**: `POST /api/admin/employees/upload` (with duplicateAction=update)

**Problem**:
- Employee data changes (name, policy, limits)
- BUT embedding still has old data
- Semantic search may return outdated info

**Fix Needed**: Should regenerate embeddings when updating employees

---

## Summary Table

| Operation | Generates Embeddings? | Notes |
|-----------|----------------------|-------|
| **Knowledge Base** |||
| Add single entry | ✅ YES | Via OpenAI API |
| Excel upload | ✅ YES | After today's fix |
| Batch import | ✅ YES | Efficient batch API call |
| Update entry | ✅ YES | If title/content changes |
| | | |
| **Employees** |||
| Add single employee | ✅ YES | Via OpenAI API |
| Excel upload (new) | ✅ YES | Batch processing |
| Excel upload (update) | ❌ NO | **Bug - needs fix** |
| Update employee (API) | ❓ Unknown | Need to check |

---

## Embedding Storage Locations

### Knowledge Base
- **Table**: `knowledge_base`
- **Column**: `embedding` (vector 1536)
- **Contains**: Title + Content text as vector

### Employees
- **Table**: `employee_embeddings` (separate table!)
- **Column**: `embedding` (vector 1536)
- **Contains**: All employee data as vector (name, ID, policy, limits, etc.)

**Note**: Employees use a SEPARATE table for embeddings, while knowledge base stores embeddings inline.

---

## What Needs Embeddings?

### Knowledge Base: **REQUIRED for search** 🔴
- Without embeddings: Search returns 0 results
- AI cannot answer questions without vector similarity
- **Critical**: Must have embeddings

### Employees: **OPTIONAL for semantic search** 🟡
- Used for natural language employee lookup
- Example: "Find employees with premium policy"
- Not used for standard employee_id lookup
- **Nice to have**: Improves search but not critical

---

## Recommendations

### ✅ Fixed Today
- Knowledge base Excel upload now generates embeddings

### ⚠️ Needs Fixing
- Employee Excel upload UPDATE path should regenerate embeddings

### 📝 Action Items
1. **Immediate**: Re-embed existing knowledge base (NULL embeddings)
2. **Future**: Fix employee update path to regenerate embeddings
3. **Testing**: Verify all paths work correctly after re-deployment

---

## Testing Checklist

After deployment, test each path:

- [ ] Knowledge: Add single entry → Check embedding NOT NULL
- [ ] Knowledge: Upload Excel → Check embeddings NOT NULL
- [ ] Knowledge: Update entry → Check embedding regenerated
- [ ] Employee: Add single → Check employee_embeddings table
- [ ] Employee: Upload Excel (new) → Check employee_embeddings table
- [ ] Employee: Upload Excel (update) → ⚠️ Embeddings WON'T update (known issue)

---

## Quick Verification Commands

```bash
# Check knowledge base embeddings
node backend/scripts/check-knowledge-embeddings.js company_a

# Check if employee embeddings exist (via psql or Supabase dashboard)
SELECT COUNT(*) FROM company_a.employee_embeddings WHERE embedding IS NOT NULL;
```
