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
 * @param {string[]|null} customKeywords - Per-company keywords from /config (merged with defaults)
 * @returns {boolean} - True if LOG keywords detected
 */
export function detectLogContext(message, customKeywords = null) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const lowerMessage = message.toLowerCase().trim();
  const keywords = customKeywords && customKeywords.length > 0
    ? [...new Set([...LOG_KEYWORDS, ...customKeywords.map(k => k.toLowerCase())])]
    : LOG_KEYWORDS;

  return keywords.some(keyword => lowerMessage.includes(keyword));
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
