const HTML_TEXT_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#039;',
  '<': '&lt;',
  '>': '&gt;',
};

/**
 * Sanitizes a plain-text string for safe HTML insertion.
 *
 * @param input Plain user-facing text, not markup.
 * @returns An HTML-safe string with reserved characters escaped.
 */
export function sanitizePlainTextForHtml(
  input: string | null | undefined
): string {
  if (!input) return '';

  return input.replace(
    /[&"'<>]/g,
    (character) => HTML_TEXT_ESCAPE_MAP[character]
  );
}
