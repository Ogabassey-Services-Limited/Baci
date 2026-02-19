// Non-backtracking tag patterns: match <tag then non-< content until </tag>
// Closing tags allow optional whitespace before > (browsers accept </script >)
const SCRIPT_RE = /<script\b[^<]*(?:<(?!\/script\s*>)[^<]*)*<\/script\s*>/gi;
const IFRAME_RE = /<iframe\b[^<]*(?:<(?!\/iframe\s*>)[^<]*)*<\/iframe\s*>/gi;
const OBJECT_RE = /<object\b[^<]*(?:<(?!\/object\s*>)[^<]*)*<\/object\s*>/gi;
const EMBED_RE = /<embed\b[^>]*\/?>/gi;
const FORM_RE = /<form\b[^<]*(?:<(?!\/form\s*>)[^<]*)*<\/form\s*>/gi;
const INPUT_RE = /<input\b[^>]*\/?>/gi;
const EVENT_RE = /\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_PROTO_RE = /javascript\s*:/gi;

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Iterative stripping: re-run until no more dangerous tags remain.
  // A single pass can be bypassed via nested-tag reconstruction (e.g. <scr<script>ipt>).
  let result = html;
  let prev = '';
  while (result !== prev) {
    prev = result;
    result = result
      .replace(SCRIPT_RE, '')
      .replace(IFRAME_RE, '')
      .replace(OBJECT_RE, '')
      .replace(EMBED_RE, '')
      .replace(FORM_RE, '')
      .replace(INPUT_RE, '')
      .replace(EVENT_RE, '')
      .replace(JS_PROTO_RE, '')
      // Hardening: catch any remaining dangerous tag openers/closers
      // that the complex patterns above may have missed
      .replace(
        /<\s*\/?\s*(?:script|iframe|object|embed|form|input)\b[^>]*>/gi,
        ''
      )
      // Normalize leftover whitespace before > from stripped attributes
      .replace(/<(\w+)\s+>/g, '<$1>');
  }
  return result;
}
