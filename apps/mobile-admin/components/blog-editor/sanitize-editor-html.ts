const BLOCKED_TAG_PATTERN =
  /<\/?(?:script|style|object|embed|applet|meta|link|form|input|button|textarea|select|base|svg|math)[^>]*>/gi;
const BLOCKED_BLOCK_PATTERN =
  /<(script|style|object|embed|applet|svg|math)[^>]*>[\s\S]*?<\/\1>/gi;
const EVENT_HANDLER_PATTERN =
  /\s+on[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const NAMESPACED_ATTRIBUTE_PATTERN =
  /\s+[a-z0-9_-]+:[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const URL_ATTRIBUTE_PATTERN =
  /\s+(href|src)\s*=\s*(?:(["'])(.*?)\2|([^\s>]+))/gi;
const IFRAME_PATTERN =
  /<iframe\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>[\s\S]*?<\/iframe>/gi;
const REMAINING_IFRAME_PATTERN =
  /<iframe\b[\s\S]*?<\/iframe>|<iframe\b[^>]*\/?>/gi;
const SAFE_IFRAME_PLACEHOLDER_PREFIX = '__BACI_SAFE_IFRAME_';

function sanitizeIframeSrc(value: string): string | null {
  try {
    const parsedUrl = new URL(value.trim());
    const allowedHostnames = new Set([
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com',
    ]);

    if (
      parsedUrl.protocol !== 'https:' ||
      !allowedHostnames.has(parsedUrl.hostname)
    ) {
      return null;
    }

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const videoId = pathSegments.at(-1) ?? '';

    if (pathSegments[0] !== 'embed' || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return null;
    }

    return `https://${parsedUrl.hostname}/embed/${videoId}`;
  } catch {
    return null;
  }
}

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

  const safeIframes: string[] = [];
  const sanitizedHtml = html
    .replace(BLOCKED_BLOCK_PATTERN, '')
    .replace(BLOCKED_TAG_PATTERN, '')
    .replace(EVENT_HANDLER_PATTERN, '')
    .replace(NAMESPACED_ATTRIBUTE_PATTERN, '')
    .replace(IFRAME_PATTERN, (_, __: string, value: string) => {
      const safeSrc = sanitizeIframeSrc(value);

      if (!safeSrc) {
        return '';
      }

      const placeholder = `${SAFE_IFRAME_PLACEHOLDER_PREFIX}${safeIframes.length}__`;

      safeIframes.push(`<iframe src="${safeSrc}" allowfullscreen></iframe>`);

      return placeholder;
    })
    .replace(REMAINING_IFRAME_PATTERN, '')
    .replace(
      URL_ATTRIBUTE_PATTERN,
      (
        _match: string,
        attribute: string,
        _quote: string | undefined,
        quotedValue: string | undefined,
        unquotedValue: string | undefined
      ) => sanitizeUrlAttribute(attribute, quotedValue ?? unquotedValue ?? '')
    );

  return safeIframes.reduce(
    (result, iframe, index) =>
      result.replace(`${SAFE_IFRAME_PLACEHOLDER_PREFIX}${index}__`, iframe),
    sanitizedHtml
  );
}
