import ExcelJS from 'exceljs';
import { supabase } from '../../config/supabase.js';

/**
 * Parse FAQ Excel file and extract quick questions
 * Expected format:
 * - 3 columns: No, Category/Question, Answer
 * - Category headers: Row where column A = "No", column B = category name, column C = "Answer"
 * - Question rows: Row where column A = number, column B = question, column C = answer
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
    'system': 'computer',
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

  // Try to find worksheet - prioritize CBRE, then FAQ Questions, then first sheet
  let worksheet = workbook.getWorksheet('CBRE') ||
                  workbook.getWorksheet('FAQ Questions') ||
                  workbook.worksheets[0];


  worksheet.eachRow((row, rowNumber) => {
    const cells = row.values;

    // Get column values (1-indexed array, so cells[1] = column A, cells[2] = column B, cells[3] = column C)
    const colA = cells[1];
    const colB = cells[2];
    const colC = cells[3];

    // Skip completely empty rows
    if (!colA && !colB && !colC) {
      return;
    }

    // Detect category header: Column A = "No", Column B = category name, Column C = "Answer"
    if (colA === 'No' && colB && (colC === 'Answer' || colC === 'answer')) {
      currentCategory = colB.toString().trim();
      currentCategoryId = createCategoryId(currentCategory);
      currentCategoryIcon = detectIcon(currentCategory);
      displayOrder = 0; // Reset display order for new category
      return;
    }

    // Detect question row: Column A = number, Column B = question text
    if (typeof colA === 'number' && colB) {
      const questionText = colB.toString().trim();
      const answerText = colC ? colC.toString().trim() : '';

      // Skip if no category has been set yet
      if (!currentCategory) {
        return;
      }

      questions.push({
        category_id: currentCategoryId,
        category_title: currentCategory,
        category_icon: currentCategoryIcon,
        question: questionText,
        answer: answerText || 'Answer not provided',
        display_order: displayOrder++,
        is_active: true
      });
    }
  });

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
      }
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
