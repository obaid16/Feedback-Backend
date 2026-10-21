/**
 * Sanitization and Defense Utilities
 */

/**
 * Escape HTML special characters to prevent HTML/XSS injection
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize prompt input to mitigate prompt-injection attacks.
 * Strips known injection markers and bounds text length.
 */
export function sanitizeForAiPrompt(text, maxLength = 1000) {
  if (typeof text !== 'string') return '';
  
  // Truncate to maximum allowed length per comment
  let sanitized = text.slice(0, maxLength);

  // Strip or neutralize common instruction override patterns
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
    /system\s+prompt/gi,
    /you\s+are\s+now\s+a/gi,
    /developer\s+mode/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[REMOVED_SUSPICIOUS_TOKEN]');
  }

  // Normalize control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized.trim();
}

/**
 * Sanitize MongoDB query object to prevent operator injection (NoSQL injection)
 */
export function sanitizeMongoQuery(input) {
  if (input === null || typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeMongoQuery);
  }

  const clean = {};
  for (const [key, value] of Object.entries(input)) {
    // Prevent top-level or nested keys beginning with '$' (e.g., $gt, $where, $ne) from untrusted input
    if (key.startsWith('$')) {
      continue;
    }
    clean[key] = sanitizeMongoQuery(value);
  }
  return clean;
}

/**
 * Normalize email (lowercase and trimmed)
 */
export function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}
