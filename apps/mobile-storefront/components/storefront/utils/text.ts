/**
 * Safely sanitize product descriptions for display as plain text.
 * Escapes angle brackets so HTML-like content cannot be interpreted as markup.
 */
export function sanitizeDescriptionPlainText(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
