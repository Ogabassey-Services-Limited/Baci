// Tag-pair patterns: match <tag...>content</tag...> including all content.
// Uses [\s\S]*? (non-greedy) for content matching across lines.
// Closing tags use \b[^>]*> to handle whitespace, attributes, or garbage
// between tag name and > (e.g. </script >, </script/>).
const SCRIPT_RE = /<script\b[\s\S]*?<\/script\b[^>]*>/gi;
const STYLE_RE = /<style\b[\s\S]*?<\/style\b[^>]*>/gi;
const IFRAME_RE = /<iframe\b[\s\S]*?<\/iframe\b[^>]*>/gi;
const OBJECT_RE = /<object\b[\s\S]*?<\/object\b[^>]*>/gi;
const EMBED_RE = /<embed\b[^>]*\/?>/gi;
const FORM_RE = /<form\b[\s\S]*?<\/form\b[^>]*>/gi;
const INPUT_RE = /<input\b[^>]*\/?>/gi;
const EVENT_RE = /\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_PROTO_RE = /javascript\s*:/gi;
const DATA_URI_RE = /(?:href|src)\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi;

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
      .replace(STYLE_RE, '')
      .replace(IFRAME_RE, '')
      .replace(OBJECT_RE, '')
      .replace(EMBED_RE, '')
      .replace(FORM_RE, '')
      .replace(INPUT_RE, '')
      .replace(EVENT_RE, '')
      .replace(JS_PROTO_RE, '')
      .replace(DATA_URI_RE, '')
      // Hardening: catch any remaining dangerous opening/closing/self-closing
      // tags that the pair-matching patterns above may have missed (e.g. orphaned
      // opening tags without a matching close)
      .replace(
        /<\s*\/?\s*(?:script|style|iframe|object|embed|form|input)\b[^>]*>/gi,
        ''
      )
      // Final hardening: strip any residual starts of dangerous tags,
      // even if they are malformed or truncated (e.g. just "<script")
      .replace(/<\s*(?:script|style|iframe|object|embed|form|input)\b/gi, '')
      // Normalize leftover whitespace before > from stripped attributes,
      // but skip dangerous tag names to avoid reconstructing stripped tags.
      .replace(
        /<(?!script\b|style\b|iframe\b|object\b|embed\b|form\b|input\b)(\w+)\s+>/gi,
        '<$1>'
      );
  }
  // Post-loop absolute hardening: character-level scan that drops any "<"
  // introducing a dangerous tag name. Avoids multi-character regex replacement
  // so static analysis (CodeQL) cannot flag incomplete sanitization.
  const dangerous = [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
  ];
  const lower = result.toLowerCase();
  let out = '';
  let i = 0;
  while (i < result.length) {
    if (result[i] === '<') {
      let j = i + 1;
      while (j < lower.length && lower[j] === ' ') j++;
      let matched = false;
      for (const name of dangerous) {
        if (lower.startsWith(name, j)) {
          matched = true;
          break;
        }
      }
      if (matched) {
        i++;
        continue;
      }
    }
    out += result[i];
    i++;
  }
  return out;
}
