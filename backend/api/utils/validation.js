/**
 * Shared Validation Utilities
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validate fieldValues against a route's requiredFields config.
 * Returns { valid: true } or { valid: false, error, code }.
 */
export function validateLogFieldValues(fieldValues = {}, requiredFields = []) {
  const missingFields = requiredFields
    .filter(f => f.required !== false && (!fieldValues[f.id] || !String(fieldValues[f.id]).trim()))
    .map(f => f.label);
  if (missingFields.length > 0) {
    return { valid: false, error: `Please fill in: ${missingFields.join(', ')}`, code: 'FIELDS_REQUIRED' };
  }
  for (const field of requiredFields) {
    const val = fieldValues[field.id];
    if (!val) continue;
    const strVal = String(val);
    if (field.type === 'date' && isNaN(Date.parse(strVal))) {
      return { valid: false, error: `Invalid date for ${field.label}`, code: 'FIELDS_REQUIRED' };
    }
    if (field.type === 'text' && strVal.length > 500) {
      return { valid: false, error: `${field.label} is too long (max 500 characters)`, code: 'FIELDS_REQUIRED' };
    }
    if (field.type === 'textarea' && strVal.length > 2000) {
      return { valid: false, error: `${field.label} is too long (max 2000 characters)`, code: 'FIELDS_REQUIRED' };
    }
  }
  return { valid: true };
}

export default { EMAIL_REGEX, isValidEmail, validateLogFieldValues };
