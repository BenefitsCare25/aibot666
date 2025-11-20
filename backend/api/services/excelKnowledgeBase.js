import ExcelJS from 'exceljs';
import { supabase, getSchemaClient } from '../../config/supabase.js';
import { addKnowledgeEntriesBatch } from './vectorDB.js';

/**
 * Parse Knowledge Base Excel file and extract entries
 * Expected format:
 * - Column A: Title
 * - Column B: Content
 * - Column C: Category (optional)
 * - Column D: Subcategory (optional)
 * First row is treated as header and skipped
 */
export async function parseKnowledgeBaseExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const entries = [];

  // Use first worksheet
  const worksheet = workbook.worksheets[0];


  let rowCount = 0;
  worksheet.eachRow((row, rowNumber) => {
    // Skip header row
    if (rowNumber === 1) {
      return;
    }

    const cells = row.values;

    // Get column values (1-indexed array)
    const title = cells[1] ? cells[1].toString().trim() : '';
    const content = cells[2] ? cells[2].toString().trim() : '';
    const category = cells[3] ? cells[3].toString().trim() : 'general';
    const subcategory = cells[4] ? cells[4].toString().trim() : '';

    // Skip completely empty rows
    if (!title && !content) {
      return;
    }

    // Validate required fields
    if (!title || !content) {
      return;
    }

    entries.push({
      title,
      content,
      category: category || 'general',
      subcategory: subcategory || null
    });

    rowCount++;
  });

  return entries;
}

/**
 * Import knowledge base entries from Excel file to database
 * IMPORTANT: This now generates embeddings for each entry using OpenAI
 */
export async function importKnowledgeBaseFromExcel(filePath, schemaName, replace = false) {
  try {
    // Parse the Excel file
    const entries = await parseKnowledgeBaseExcel(filePath);

    if (entries.length === 0) {
      throw new Error('No entries found in Excel file');
    }

    // Get schema-specific Supabase client
    const schemaClient = getSchemaClient(schemaName);

    // If replace is true, delete existing entries
    if (replace) {
      const { error: deleteError } = await supabase.rpc('delete_all_knowledge_entries', {
        schema_name: schemaName
      });

      if (deleteError) {
        console.error('Error deleting existing entries:', deleteError);
        // Continue even if delete fails (table might be empty)
      }
    }

    // Process entries in batches to avoid overwhelming OpenAI API
    const BATCH_SIZE = 20; // Process 20 entries at a time
    let inserted = 0;
    const failed = [];


    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      try {
        // Use addKnowledgeEntriesBatch which generates embeddings
        const result = await addKnowledgeEntriesBatch(batch, schemaClient);

        if (result && result.length > 0) {
          inserted += result.length;
        }
      } catch (batchError) {
        console.error(`❌ Error processing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, batchError);
        // Add all entries in failed batch to failed list
        batch.forEach(entry => {
          failed.push({ entry, error: batchError.message });
        });
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (failed.length > 0) {
    }

    return {
      success: true,
      imported: inserted,
      total: entries.length,
      failed: failed.length,
      failedEntries: failed,
      categories: [...new Set(entries.map(e => e.category))]
    };
  } catch (error) {
    console.error('Error importing knowledge base from Excel:', error);
    throw error;
  }
}
