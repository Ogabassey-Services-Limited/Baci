const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const IFRAME_RE = /<iframe\b[^>]*>.*?<\/iframe>/gi;
const OBJECT_RE = /<object\b[^>]*>.*?<\/object>/gi;
const EMBED_RE = /<embed\b[^>]*\/?>/gi;
const FORM_RE = /<form\b[^>]*>.*?<\/form>/gi;
const INPUT_RE = /<input\b[^>]*\/?>/gi;
const EVENT_RE = /\bon\w+\s*=\s*["'][^"']*["']/gi;
const JS_PROTO_RE = /javascript\s*:/gi;

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(SCRIPT_RE, '')
    .replace(IFRAME_RE, '')
    .replace(OBJECT_RE, '')
    .replace(EMBED_RE, '')
    .replace(FORM_RE, '')
    .replace(INPUT_RE, '')
    .replace(EVENT_RE, '')
    .replace(JS_PROTO_RE, '');
}
