const BLOCKED_TAG_PATTERN =
  /<\/?(?:script|style|object|embed|applet|iframe|meta|link|form|input|button|textarea|select|base)[^>]*>/gi;
const BLOCKED_BLOCK_PATTERN =
  /<(script|style|object|embed|applet|iframe)[^>]*>[\s\S]*?<\/\1>/gi;
const EVENT_HANDLER_PATTERN =
  /\s+on[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const URL_ATTRIBUTE_PATTERN = /\s+(href|src)\s*=\s*(["'])(.*?)\2/gi;

function sanitizeUrlAttribute(attribute: string, value: string): string {
  const trimmedValue = value.trim();
  const lowerValue = trimmedValue.toLowerCase();

  if (
    lowerValue.startsWith('javascript:') ||
    lowerValue.startsWith('vbscript:') ||
    lowerValue.startsWith('data:')
  ) {
    return attribute === 'href' ? ' href="#"' : ' src=""';
  }

  return ` ${attribute}="${trimmedValue}"`;
}

export function sanitizeEditorHtml(html: string): string {
  if (!html) {
    return '';
  }

  return html
    .replace(BLOCKED_BLOCK_PATTERN, '')
    .replace(BLOCKED_TAG_PATTERN, '')
    .replace(EVENT_HANDLER_PATTERN, '')
    .replace(
      URL_ATTRIBUTE_PATTERN,
      (_, attribute: string, __: string, value: string) =>
        sanitizeUrlAttribute(attribute, value)
    );
}
