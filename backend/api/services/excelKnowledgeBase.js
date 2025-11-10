import ExcelJS from 'exceljs';
import { supabase } from '../../config/supabase.js';

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

  console.log(`Processing worksheet: ${worksheet.name}`);

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
      console.log(`Warning: Row ${rowNumber} missing required fields (title or content)`);
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

  console.log(`Parsed ${entries.length} knowledge base entries`);
  return entries;
}

/**
 * Import knowledge base entries from Excel file to database
 */
export async function importKnowledgeBaseFromExcel(filePath, schemaName, replace = false) {
  try {
    // Parse the Excel file
    const entries = await parseKnowledgeBaseExcel(filePath);

    if (entries.length === 0) {
      throw new Error('No entries found in Excel file');
    }

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

    // Insert entries one by one using RPC function
    let inserted = 0;
    const failed = [];

    for (const entry of entries) {
      try {
        const { data, error } = await supabase.rpc('insert_knowledge_entry', {
          schema_name: schemaName,
          p_title: entry.title,
          p_content: entry.content,
          p_category: entry.category,
          p_subcategory: entry.subcategory
        });

        if (error) {
          console.error(`Error inserting entry "${entry.title}":`, error);
          failed.push({ entry, error: error.message });
        } else {
          inserted++;
          if (inserted % 10 === 0) {
            console.log(`Inserted ${inserted}/${entries.length} entries`);
          }
        }
      } catch (err) {
        console.error(`Exception inserting entry "${entry.title}":`, err);
        failed.push({ entry, error: err.message });
      }
    }

    console.log(`Successfully imported ${inserted} entries from Excel`);

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
