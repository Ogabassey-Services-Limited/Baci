const SCRIPT_RE = /<script\b[\s\S]*?<\/script>/gi;
const IFRAME_RE = /<iframe\b[\s\S]*?<\/iframe>/gi;
const OBJECT_RE = /<object\b[\s\S]*?<\/object>/gi;
const EMBED_RE = /<embed\b[^>]*\/?>/gi;
const FORM_RE = /<form\b[\s\S]*?<\/form>/gi;
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
      .replace(JS_PROTO_RE, '');
  }
  return result;
}
