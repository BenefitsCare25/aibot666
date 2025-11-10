# Knowledge Base Excel Upload Implementation

## Overview
Added Excel upload functionality to the Knowledge Base page, similar to the Quick Questions upload feature.

## Components Created/Modified

### Backend

1. **Excel Parsing Service** (`backend/api/services/excelKnowledgeBase.js`)
   - Parses Excel files with knowledge base entries
   - Expected format:
     - Column A: Title (required)
     - Column B: Content (required)
     - Column C: Category (optional, defaults to 'general')
     - Column D: Subcategory (optional)
     - First row is treated as header and skipped
   - Functions:
     - `parseKnowledgeBaseExcel(filePath)` - Parses Excel and returns entries
     - `importKnowledgeBaseFromExcel(filePath, schemaName, replace)` - Imports to database

2. **API Endpoint** (`backend/api/routes/admin.js`)
   - POST `/api/admin/knowledge/upload-excel`
   - Accepts multipart/form-data with file upload
   - Supports replace mode to clear existing entries
   - Returns success message with import statistics

3. **Database Functions** (`backend/config/supabase-setup/08-cross-schema-access.sql`)
   - `insert_knowledge_entry(schema_name, p_title, p_content, p_category, p_subcategory)` - Inserts single entry
   - `delete_all_knowledge_entries(schema_name)` - Deletes all entries (for replace mode)

### Frontend

1. **API Client** (`frontend/admin/src/api/knowledge.js`)
   - Added `uploadExcel(file, replace)` method
   - Handles FormData upload with multipart/form-data

2. **UI Components** (`frontend/admin/src/pages/KnowledgeBase.jsx`)
   - Added "Upload Excel" button in header
   - Upload modal with:
     - File selector (.xlsx, .xls)
     - Replace existing checkbox
     - Format instructions
     - Upload progress indicator
   - State management for upload flow
   - Error handling with toast notifications

## Excel Format

| Column A | Column B | Column C | Column D |
|----------|----------|----------|----------|
| Title    | Content  | Category | Subcategory |
| Benefit Coverage Policy | Employees are covered for... | benefits | medical |
| Claims Process | To submit a claim... | claims | reimbursement |

## Usage

1. Navigate to Knowledge Base page in admin panel
2. Click "Upload Excel" button
3. Select Excel file (.xlsx or .xls)
4. Optionally check "Replace all existing entries"
5. Click "Upload & Import"
6. Success message shows imported count and categories

## Database Setup Required

Run the SQL script to create the RPC functions:

```bash
# Using Supabase CLI
supabase db push

# Or manually run the SQL from:
backend/config/supabase-setup/08-cross-schema-access.sql
```

The functions created:
- `public.insert_knowledge_entry()` - Inserts entries into company-specific schemas
- `public.delete_all_knowledge_entries()` - Clears all entries for replace mode

## Features

- Batch import of knowledge base entries from Excel
- Replace mode to clear and re-import all entries
- Schema validation for safe SQL execution
- Error handling for failed imports
- Progress tracking during upload
- Category and subcategory support
- Toast notifications for success/error states

## Testing

1. Create test Excel file with sample data
2. Upload with replace mode unchecked (appends)
3. Upload with replace mode checked (replaces all)
4. Verify entries appear in knowledge base list
5. Test with invalid Excel format
6. Test with empty file
7. Test with missing required columns
