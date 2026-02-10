/**
 * Shared Quick Questions Utilities
 */

/**
 * Group flat quick questions array into categorized structure
 * @param {Array} questions - Flat array of quick question rows
 * @returns {Array} - Array of category objects with nested questions
 */
export function groupQuestionsByCategory(questions) {
  const categorized = {};
  questions?.forEach(q => {
    if (!categorized[q.category_id]) {
      categorized[q.category_id] = {
        id: q.category_id,
        title: q.category_title,
        icon: q.category_icon,
        questions: []
      };
    }
    categorized[q.category_id].questions.push({
      id: q.id,
      q: q.question,
      a: q.answer,
      display_order: q.display_order
    });
  });
  return Object.values(categorized);
}

export default { groupQuestionsByCategory };
