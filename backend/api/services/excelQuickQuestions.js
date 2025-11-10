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

    // If replace is true, delete existing questions using RPC
    if (replace) {
      // Use RPC to delete all questions from the schema
      const { error: deleteError } = await supabase.rpc('delete_all_quick_questions', {
        schema_name: schemaName
      });

      if (deleteError) {
        console.error('Error deleting existing questions:', deleteError);
        // Continue even if delete fails (table might be empty)
      }
    }

    // Insert questions one by one using RPC function
    let inserted = 0;

    for (const q of questions) {
      const { data, error } = await supabase.rpc('insert_quick_question', {
        schema_name: schemaName,
        p_category_id: q.category_id,
        p_category_title: q.category_title,
        p_category_icon: q.category_icon,
        p_question: q.question,
        p_answer: q.answer,
        p_display_order: q.display_order,
        p_is_active: q.is_active
      });

      if (error) {
        console.error(`Error inserting question:`, error);
        throw error;
      }

      inserted++;
      if (inserted % 10 === 0) {
        console.log(`Inserted ${inserted}/${questions.length} questions`);
      }
    }

    console.log(`Successfully imported ${inserted} questions from Excel`);

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
