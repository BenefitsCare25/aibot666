/**
 * LOG Attachment Validation
 * Server-side validation of LOG request attachments.
 * Logic mirrors frontend validateLogAttachments() in LoginForm.jsx.
 */

const LOG_BLOCKLIST = /receipt|claim|invoice|reimburse|\bmc\b|medical\.cert|payment/i;

const LOG_STOPWORDS = new Set([
  'the', 'and', 'or', 'of', 'from', 'for', 'in', 'on', 'at', 'to', 'a', 'an',
  'this', 'that', 'with', 'when', 'applicable', 'download', 'chat', 'widget',
  'obtained', 'complete', 'pte', 'ltd', 'asia', 'pacific'
]);

function normalizeFilename(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[_\-]/g, ' ').toLowerCase().trim();
}

function extractKeyTokens(name) {
  return normalizeFilename(name)
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !LOG_STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function isLogDocumentMatch(fileTokens, expectedTokenSets) {
  return expectedTokenSets.some(expTokens => {
    const overlap = expTokens.filter(t => fileTokens.has(t)).length;
    return overlap >= Math.min(2, expTokens.length);
  });
}

/**
 * Validate LOG attachments against route requirements.
 * @param {Array} attachments - [{name, ...}]
 * @param {Object|null} logRoute - route object with requiredDocuments
 * @param {Object|null} logConfig - full logConfig with downloadableFiles
 * @returns {Array} warnings - empty if valid, non-empty if blocked
 */
export function validateLogAttachments(attachments, logRoute, logConfig) {
  if (!logRoute?.requiredDocuments?.length) return [];
  if (!attachments.length) return [{ reason: 'required' }];

  const expectedTokenSets = [];
  for (const doc of logRoute.requiredDocuments) {
    const tokens = extractKeyTokens(doc.name);
    if (tokens.length) expectedTokenSets.push(tokens);
    if (doc.downloadKey && logConfig?.downloadableFiles?.[doc.downloadKey]?.fileName) {
      const fileTokens = extractKeyTokens(logConfig.downloadableFiles[doc.downloadKey].fileName);
      if (fileTokens.length) expectedTokenSets.push(fileTokens);
    }
  }

  const hasExpectedDoc = attachments.some(att => {
    const normalized = normalizeFilename(att.name);
    if (LOG_BLOCKLIST.test(normalized)) return false;
    const fileTokens = new Set(normalized.split(/\s+/).filter(t => t.length > 2));
    return isLogDocumentMatch(fileTokens, expectedTokenSets);
  });

  if (hasExpectedDoc) return [];

  const warnings = [];
  for (const att of attachments) {
    const normalized = normalizeFilename(att.name);
    if (LOG_BLOCKLIST.test(normalized)) {
      warnings.push({ filename: att.name, reason: 'blocklist' });
    } else {
      warnings.push({ filename: att.name, reason: 'no_match' });
    }
  }
  return warnings;
}
