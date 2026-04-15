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
const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  colon: ':',
  gt: '>',
  lt: '<',
  newline: '\n',
  quot: '"',
  tab: '\t',
};
const IFRAME_ATTRIBUTE_PATTERN =
  /\s+([a-z-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
const ALLOWED_IFRAME_LOADING_VALUES = new Set(['eager', 'lazy']);
const ALLOWED_IFRAME_SANDBOX_TOKENS = new Set([
  'allow-forms',
  'allow-presentation',
  'allow-same-origin',
  'allow-scripts',
]);

function isValidCodePoint(codePoint: number): boolean {
  return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function sanitizeIframeAttribute(name: string, value: string): string | null {
  if (name === 'loading') {
    const normalizedValue = value.trim().toLowerCase();

    if (!ALLOWED_IFRAME_LOADING_VALUES.has(normalizedValue)) {
      return null;
    }

    return ` loading="${normalizedValue}"`;
  }

  if (name === 'sandbox') {
    const normalizedTokens = value
      .split(/\s+/u)
      .map((token) => token.trim().toLowerCase())
      .filter((token) => ALLOWED_IFRAME_SANDBOX_TOKENS.has(token));

    if (normalizedTokens.length === 0) {
      return null;
    }

    return ` sandbox="${normalizedTokens.join(' ')}"`;
  }

  if (name === 'title') {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return null;
    }

    return ` title="${escapeHtmlAttribute(normalizedValue)}"`;
  }

  return null;
}

function buildSafeIframeHtml(match: string, safeSrc: string): string {
  const attributes: string[] = [];
  const seenAttributes = new Set<string>();

  match.replace(
    IFRAME_ATTRIBUTE_PATTERN,
    (
      _attributeMatch: string,
      rawName: string,
      doubleQuotedValue: string | undefined,
      singleQuotedValue: string | undefined,
      unquotedValue: string | undefined
    ) => {
      const name = rawName.toLowerCase();

      if (
        name === 'src' ||
        name === 'allowfullscreen' ||
        seenAttributes.has(name)
      ) {
        return '';
      }

      const sanitizedAttribute = sanitizeIframeAttribute(
        name,
        doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? ''
      );

      if (sanitizedAttribute) {
        seenAttributes.add(name);
        attributes.push(sanitizedAttribute);
      }

      return '';
    }
  );

  return `<iframe src="${safeSrc}"${attributes.join('')} allowfullscreen></iframe>`;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return isValidCodePoint(codePoint)
        ? String.fromCodePoint(codePoint)
        : match;
    }

    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return isValidCodePoint(codePoint)
        ? String.fromCodePoint(codePoint)
        : match;
    }

    return HTML_ENTITY_MAP[entity.toLowerCase()] ?? match;
  });
}

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

function normalizeUrlSchemeValue(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127 && !/\s/u.test(character);
    })
    .join('')
    .toLowerCase();
}

function sanitizeUrlAttribute(attribute: string, value: string): string {
  const trimmedValue = value.trim();
  const normalizedValue = normalizeUrlSchemeValue(
    decodeHtmlEntities(trimmedValue)
  );

  if (
    normalizedValue.startsWith('javascript:') ||
    normalizedValue.startsWith('vbscript:') ||
    normalizedValue.startsWith('data:')
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
    .replace(IFRAME_PATTERN, (match: string, __: string, value: string) => {
      const safeSrc = sanitizeIframeSrc(value);

      if (!safeSrc) {
        return '';
      }

      const placeholder = `${SAFE_IFRAME_PLACEHOLDER_PREFIX}${safeIframes.length}__`;

      safeIframes.push(buildSafeIframeHtml(match, safeSrc));

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
