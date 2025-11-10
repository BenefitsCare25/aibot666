import ExcelJS from 'exceljs';
import { supabase } from '../../config/supabase.js';

/**
 * Parse FAQ Excel file and extract quick questions
 * Expected format:
 * - Column with questions (may be labeled "Benefit Coverage" or similar)
 * - Column with answers
 * - Section headers to denote categories (e.g., "Letter of Guarantee (LOG)", "Portal Matters")
 */
export async function parseQuickQuestionsExcel(filePath, schemaName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const questions = [];
  let currentCategory = null;
  let currentCategoryId = null;
  let currentCategoryIcon = 'question';
  let displayOrder = 0;

  // Category icon mapping
  const iconMapping = {
    'benefit': 'shield',
    'coverage': 'shield',
    'letter of guarantee': 'document',
    'log': 'document',
    'portal': 'computer',
    'claims': 'clipboard',
    'claim': 'clipboard'
  };

  // Function to detect category icon based on title
  const detectIcon = (title) => {
    const lowerTitle = title.toLowerCase();
    for (const [keyword, icon] of Object.entries(iconMapping)) {
      if (lowerTitle.includes(keyword)) {
        return icon;
      }
    }
    return 'question';
  };

  // Function to create category ID from title
  const createCategoryId = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  };

  // Try to find the CBRE sheet or use first sheet
  let worksheet = workbook.getWorksheet('CBRE') || workbook.worksheets[0];

  console.log(`Processing worksheet: ${worksheet.name}`);

  worksheet.eachRow((row, rowNumber) => {
    // Skip first few rows (headers)
    if (rowNumber < 3) return;

    const cells = row.values;

    // Try to get question and answer from columns
    // Column 2 usually has the question, Column 3 has the answer
    const questionText = cells[2];
    const answerText = cells[3];

    // Skip empty rows
    if (!questionText || questionText === 'nan' || questionText.toString().trim() === '') {
      return;
    }

    // Check if this is a category header (has "Answer" in answer column or answer is "Answer")
    if (answerText === 'Answer' || answerText === 'answer' || (!answerText || answerText === 'nan')) {
      // This is a category header
      currentCategory = questionText.toString().trim();
      currentCategoryId = createCategoryId(currentCategory);
      currentCategoryIcon = detectIcon(currentCategory);
      displayOrder = 0; // Reset display order for new category
      console.log(`Found category: ${currentCategory} (${currentCategoryId})`);
      return;
    }

    // This is a question-answer pair
    if (currentCategory && answerText && answerText !== 'nan') {
      questions.push({
        category_id: currentCategoryId || 'general',
        category_title: currentCategory || 'General Questions',
        category_icon: currentCategoryIcon,
        question: questionText.toString().trim(),
        answer: answerText.toString().trim(),
        display_order: displayOrder++,
        is_active: true
      });
    }
  });

  console.log(`Parsed ${questions.length} questions from ${currentCategory ? 'categorized' : 'uncategorized'} data`);
  return questions;
}

/**
 * Import quick questions from Excel file to database
 */
export async function importQuickQuestionsFromExcel(filePath, schemaName, replace = false) {
  try {
    // Parse the Excel file
    const questions = await parseQuickQuestionsExcel(filePath, schemaName);

    if (questions.length === 0) {
      throw new Error('No questions found in Excel file');
    }

    // Create schema-specific Supabase client
    const { data: schemaData, error: schemaError } = await supabase.rpc('set_config', {
      setting: 'search_path',
      value: `${schemaName}, public`
    });

    // If replace is true, delete existing questions
    if (replace) {
      const { error: deleteError } = await supabase
        .from('quick_questions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        console.error('Error deleting existing questions:', deleteError);
      }
    }

    // Insert questions in batches
    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);

      const { data, error } = await supabase
        .from('quick_questions')
        .insert(batch)
        .select();

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        throw error;
      }

      inserted += batch.length;
      console.log(`Inserted batch ${i / batchSize + 1}: ${batch.length} questions`);
    }

    return {
      success: true,
      imported: inserted,
      total: questions.length,
      categories: [...new Set(questions.map(q => q.category_title))]
    };
  } catch (error) {
    console.error('Error importing quick questions from Excel:', error);
    throw error;
  }
}
