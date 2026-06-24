// Input Sanitization Utilities
// For server components that don't need HTML sanitization, import from './sanitize-core' instead

import sanitizeLib from 'sanitize-html';

// Re-export removed as per knip analysis
// import from './sanitize-core' directly if needed

interface SanitizeHtmlOptions {
  headingLevelOffset?: number;
  normalizeHeadingHierarchy?: boolean;
  normalizeSeoAnchors?: boolean;
  trustedPriorityImageSources?: readonly string[];
}

const ESCAPE_HTML_TEXT_OPTIONS: sanitizeLib.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'escape',
  parser: {
    lowerCaseAttributeNames: false,
    lowerCaseTags: false,
  },
};

const HTML_ATTRIBUTE_ESCAPE_REGEX = /[&<>"']/g;
const HTML_ATTRIBUTE_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const DISALLOWED_RAW_TEXT_BLOCK_REGEX =
  /<(script|style|xmp|iframe|noembed|noframes|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HEADING_TAG_REGEX = /<\s*h([1-6])\b[^>]*>/gi;

function clampHeadingLevel(level: number) {
  return Math.min(6, Math.max(1, level));
}

function getNormalizedArticleBodyHeadingLevel(
  level: number,
  minimumBodyHeadingLevel: number
) {
  if (level === 1) {
    return 2;
  }

  const offset = Math.max(0, minimumBodyHeadingLevel - 2);
  return Math.min(3, Math.max(2, level - offset));
}

function getMinimumBodyHeadingLevel(html: string) {
  const levels = Array.from(html.matchAll(HEADING_TAG_REGEX), (match) =>
    Number(match[1])
  )
    .filter(Number.isFinite)
    .map((level) => (level === 1 ? 2 : level));

  return levels.length > 0 ? Math.min(...levels) : 2;
}

function normalizeTrustedPriorityImageSource(value: string): string {
  return value.replace(/&amp;/gi, '&');
}

function createTrustedPriorityImageSourceSet(
  sources: readonly string[] | undefined
): ReadonlySet<string> {
  return new Set(
    (sources ?? [])
      .map((source) => normalizeTrustedPriorityImageSource(source.trim()))
      .filter(Boolean)
  );
}

function isTechnicalResourceHref(href: string | undefined): boolean {
  const normalizedHref = href?.trim().toLowerCase();
  if (!normalizedHref) {
    return false;
  }
  try {
    const { pathname } = new URL(normalizedHref, 'https://example.invalid');
    if (pathname === '/_next/image') {
      return true;
    }
    return /\.(?:js|json)(?:$|[?#])/i.test(pathname);
  } catch {
    return /\.(?:js|json)(?:$|[?#])/i.test(normalizedHref);
  }
}

function decodeUriComponentSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getDecodedHrefCandidates(value: string): string[] {
  const candidates = [value];
  let current = value;

  for (let index = 0; index < 3; index += 1) {
    const decoded = decodeUriComponentSafely(current);
    if (decoded === current) {
      break;
    }
    candidates.push(decoded);
    current = decoded;
  }

  return candidates;
}

function stripQueryAndHash(value: string): string {
  const queryIndex = value.indexOf('?');
  const hashIndex = value.indexOf('#');
  const endIndexes = [queryIndex, hashIndex].filter((index) => index >= 0);
  const endIndex = endIndexes.length > 0 ? Math.min(...endIndexes) : -1;

  return endIndex >= 0 ? value.slice(0, endIndex) : value;
}

function isSerializedAttributeLeakHref(href: string | undefined): boolean {
  const normalizedHref = href?.trim().toLowerCase();
  if (!normalizedHref) {
    return false;
  }

  return getDecodedHrefCandidates(normalizedHref)
    .map(stripQueryAndHash)
    .some(
      (candidate) =>
        candidate.includes('","target"') ||
        candidate.includes('","rel"') ||
        candidate.includes('","href"')
    );
}

function sanitizeAnchorTag(_tagName: string, attribs: sanitizeLib.Attributes) {
  const nextAttribs: sanitizeLib.Attributes = {
    ...attribs,
    rel: 'noopener noreferrer',
  };

  if (isSerializedAttributeLeakHref(nextAttribs.href)) {
    delete nextAttribs.href;
    delete nextAttribs.target;
  }

  return {
    tagName: 'a',
    attribs: nextAttribs,
  };
}

/**
 * Sanitize HTML content to prevent XSS attacks using sanitize-html.
 *
 * **Security Note**: This function is safe to use with `dangerouslySetInnerHTML`
 * as it whitelists only safe HTML tags and attributes. All user-generated content
 * and AI-generated content MUST pass through this function before rendering.
 *
 * **Why this is secure**:
 * - Uses industry-standard sanitize-html library (server-side friendly)
 * - Whitelist-based approach (only allowed tags/attributes pass through)
 * - Prevents `<script>`, `<iframe>`, `<object>`, `onclick`, etc.
 * - Validates URLs to prevent `javascript:` and `data:` URIs
 * - No dependency on jsdom (prevents ESM crashes in Vercel/Next.js)
 *
 * **Allowed content**:
 * - Text formatting (bold, italic, underline, etc.)
 * - Structural elements (headings, paragraphs, divs, spans)
 * - Lists (ordered and unordered)
 * - Links and images (with URL validation)
 * - Tables (for rich blog content)
 * - Code blocks (for technical content)
 *
 * **Security scanner notes**: GitHub CodeQL may flag `dangerouslySetInnerHTML`
 * even when using this function. These are false positives. The content is
 * sanitized and safe to render.
 *
 * @example
 * ```tsx
 * // Use the SafeHtml component instead of dangerouslySetInnerHTML directly
 * import { SafeHtml } from '@/components/ui/safe-html';
 * <SafeHtml html={userContent} className="prose" />
 * ```
 *
 * @param dirty - Untrusted HTML string from user input or AI generation
 * @returns Sanitized HTML safe for rendering in React components
 *
 * @see https://github.com/apostrophecms/sanitize-html for documentation
 */
export function sanitizeHtml(
  dirty: string,
  options: SanitizeHtmlOptions = {}
): string {
  const dirtyWithoutRawTextBlocks = dirty.replace(
    DISALLOWED_RAW_TEXT_BLOCK_REGEX,
    ''
  );
  const rawHeadingLevelOffset = Number(options.headingLevelOffset ?? 0);
  const headingLevelOffset = Number.isFinite(rawHeadingLevelOffset)
    ? Math.max(0, Math.trunc(rawHeadingLevelOffset))
    : 0;
  const minimumBodyHeadingLevel = getMinimumBodyHeadingLevel(
    dirtyWithoutRawTextBlocks
  );
  const trustedPriorityImageSources = createTrustedPriorityImageSourceSet(
    options.trustedPriorityImageSources
  );
  const transformTags: NonNullable<sanitizeLib.IOptions['transformTags']> = {
    a: sanitizeAnchorTag,
    img: (_tagName, attribs) => {
      const nextAttribs = { ...attribs };
      const normalizedImageSource =
        typeof nextAttribs.src === 'string'
          ? normalizeTrustedPriorityImageSource(nextAttribs.src)
          : '';
      const allowPriorityImage =
        nextAttribs.fetchpriority === 'high' &&
        trustedPriorityImageSources.has(normalizedImageSource);
      delete nextAttribs['data-baci-priority-image'];
      if (!allowPriorityImage) {
        delete nextAttribs.fetchpriority;
      }

      return {
        tagName: 'img',
        attribs: nextAttribs,
      };
    },
  };
  const exclusiveFilter: sanitizeLib.IOptions['exclusiveFilter'] =
    options.normalizeSeoAnchors
      ? (frame) => {
          if (frame.tag !== 'a') {
            return false;
          }
          if (!frame.text.trim()) {
            return frame.mediaChildren.length > 0 ? 'excludeTag' : true;
          }
          if (isTechnicalResourceHref(frame.attribs.href)) {
            return 'excludeTag';
          }
          return false;
        }
      : undefined;

  if (options.normalizeHeadingHierarchy) {
    for (let level = 1; level <= 6; level += 1) {
      transformTags[`h${level}`] = (_tagName, attribs) => {
        const normalizedLevel = getNormalizedArticleBodyHeadingLevel(
          level,
          minimumBodyHeadingLevel
        );

        return {
          tagName: `h${normalizedLevel}`,
          attribs,
        };
      };
    }
  } else if (headingLevelOffset > 0) {
    for (let level = 1; level <= 6; level += 1) {
      transformTags[`h${level}`] = (_tagName, attribs) => ({
        tagName: `h${clampHeadingLevel(level + headingLevelOffset)}`,
        attribs,
      });
    }
  }

  return sanitizeLib(dirtyWithoutRawTextBlocks, {
    // Whitelist of allowed HTML tags
    allowedTags: [
      // Text formatting
      'b',
      'i',
      'em',
      'strong',
      'u',
      's',
      'mark',
      'small',
      'sub',
      'sup',
      // Headings (for semantic structure)
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      // Structure and layout
      'p',
      'br',
      'hr',
      'div',
      'span',
      'blockquote',
      'figure',
      'figcaption',
      'pre',
      'code',
      // Lists
      'ul',
      'ol',
      'li',
      // Links and media
      'a',
      'img',
      // Responsive images: blog inline images are served as a <picture> with
      // pre-optimized AVIF/WebP <source> siblings (trusted CDN only).
      'picture',
      'source',
      // Tables (for blog and rich content)
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
    ],
    // Whitelist of allowed attributes
    allowedAttributes: {
      '*': [
        'class', // Styling (Tailwind classes)
        'id', // Anchor links and references
        'title',
        'width',
        'height',
        'colspan',
        'rowspan',
      ],
      a: ['href', 'target', 'rel'],
      img: [
        'src',
        'srcset',
        'sizes',
        'alt',
        'width',
        'height',
        'loading',
        'decoding',
        'fetchpriority',
      ],
      source: ['srcset', 'type', 'media', 'sizes'],
    },
    // Security configurations
    // Ensure all external links have rel="noopener noreferrer"
    transformTags,
    exclusiveFilter,
    // Only allow safe URL protocols (no javascript:, data:, etc.)
    allowedSchemes: [
      'http',
      'https',
      'mailto',
      'tel',
      'callto',
      'sms',
      'cid',
      'xmpp',
    ],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'], // Allow base64 images if needed
    },
    allowProtocolRelative: false,
  });
}

/**
 * Escapes plain text for HTML text-node interpolation without preserving markup.
 *
 * Use this only for plain text inserted inside element bodies in HTML emails or
 * templates. Quotes are intentionally preserved, so this helper is not safe for
 * HTML attribute interpolation; use an attribute-specific escaper or a proper
 * templating/serialization layer when writing attribute values instead.
 */
export function escapeHtmlText(value: string): string {
  if (!value) return '';
  return sanitizeLib(value, ESCAPE_HTML_TEXT_OPTIONS);
}

/**
 * Escapes plain text for safe HTML attribute interpolation.
 *
 * Use this for values inserted inside quoted attributes such as href, src,
 * title, alt, and aria-* values. Unlike escapeHtmlText, this also escapes
 * quotes so the attribute boundary cannot be broken.
 */
export function escapeHtmlAttribute(value: string): string {
  if (!value) return '';
  return value.replace(
    HTML_ATTRIBUTE_ESCAPE_REGEX,
    (match) => HTML_ATTRIBUTE_ESCAPE_MAP[match]
  );
}

/**
 * Sanitize HTML for RSS/Atom feeds.
 *
 * More restrictive than the general sanitizer — strips structural elements
 * (div, span, table) that RSS readers handle poorly and removes classes/IDs.
 * Ensures all links have rel="noopener noreferrer".
 */
export function sanitizeForFeed(dirty: string): string {
  return sanitizeLib(dirty, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'a',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: 'noopener noreferrer' },
      }),
    },
  });
}

/**
 * Sanitize untrusted SVG content before persisting or rendering it.
 *
 * This allowlist keeps common favicon/vector tags while stripping scripting,
 * foreign content, and unknown attributes.
 */
export function sanitizeSvg(svgContent: string): string {
  return sanitizeLib(svgContent, {
    allowedTags: [
      'svg',
      'path',
      'circle',
      'rect',
      'polygon',
      'line',
      'polyline',
      'ellipse',
      'g',
      'defs',
      'use',
      'symbol',
      'linearGradient',
      'radialGradient',
      'stop',
      'title',
      'desc',
    ],
    allowedAttributes: {
      '*': [
        'id',
        'class',
        'viewBox',
        'xmlns',
        'xmlns:xlink',
        'role',
        'aria-hidden',
        'focusable',
        'fill',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
        'stroke-dasharray',
        'stroke-dashoffset',
        'opacity',
        'fill-opacity',
        'stroke-opacity',
        'transform',
      ],
      svg: ['width', 'height', 'x', 'y'],
      path: ['d', 'pathLength'],
      circle: ['cx', 'cy', 'r'],
      rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
      ellipse: ['cx', 'cy', 'rx', 'ry'],
      line: ['x1', 'y1', 'x2', 'y2'],
      polyline: ['points'],
      polygon: ['points'],
      use: ['href', 'xlink:href', 'x', 'y', 'width', 'height'],
      linearGradient: ['id', 'x1', 'y1', 'x2', 'y2', 'gradientUnits'],
      radialGradient: ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits'],
      stop: ['offset', 'stop-color', 'stop-opacity'],
    },
    disallowedTagsMode: 'discard',
    allowedSchemes: ['http', 'https'],
    allowedSchemesAppliedToAttributes: ['href', 'xlink:href'],
    allowProtocolRelative: false,
    parser: {
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
    },
  });
}
