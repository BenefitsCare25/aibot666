/**
 * Utility functions for detecting LOG (Letter of Guarantee) related context
 */

// Keywords that indicate user might need a LOG request
const LOG_KEYWORDS = [
  'log',
  'letter of guarantee',
  'guarantee letter',
  'need log',
  'request log',
  'need a log',
  'need guarantee',
  'hospital admission',
  'medical guarantee',
  'hospital letter',
  'admission letter',
  'hospital guarantee',
  'financial care',
  'pre-admission',
  'hospital form'
];

/**
 * Detect if a message contains LOG-related keywords
 * @param {string} message - The user's message
 * @returns {boolean} - True if LOG keywords detected
 */
export function detectLogContext(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const lowerMessage = message.toLowerCase().trim();

  return LOG_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Detect if a quick question category is LOG-related
 * @param {string} categoryTitle - The category title
 * @returns {boolean} - True if category is LOG-related
 */
export function isLogCategory(categoryTitle) {
  if (!categoryTitle || typeof categoryTitle !== 'string') {
    return false;
  }

  const lowerTitle = categoryTitle.toLowerCase();
  return lowerTitle.includes('letter of guarantee') || lowerTitle.includes('log');
}
