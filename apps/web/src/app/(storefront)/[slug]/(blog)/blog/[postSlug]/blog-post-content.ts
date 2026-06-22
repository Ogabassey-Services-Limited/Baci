import { marked } from 'marked';

export { getBlogPostTextPreview } from '@/lib/blog-utils';

import {
  buildInlineImageSiblings,
  isTrustedCdnInlineImage,
} from '@/lib/blog-inline-image-optimization';
import { escapeHtmlText, sanitizeHtml } from '@/lib/sanitize';
import { buildStoreUrl } from '@/lib/store-url';
import { rewriteHtmlStorefrontHrefs } from '@/lib/storefront-html-link-rewriting';
import type { NormalizeStorefrontContentHrefOptions } from '@/lib/storefront-link-normalization';

const DEFAULT_BLOG_IMAGE_ALT = 'Blog image';

const STANDALONE_IMAGE_BOUNDARY_TAGS = new Set(
  'article aside blockquote body dd details div dt figure footer h1 h2 h3 h4 h5 h6 header img li main nav ol p section ul'.split(
    ' '
  )
);
const HTML_TAG_AT_END_REGEX = /<\s*\/?\s*([a-z][a-z0-9-]*)\b[^>]*>\s*$/i;
const HTML_TAG_AT_START_REGEX = /^\s*<\s*\/?\s*([a-z][a-z0-9-]*)\b[^>]*>/i;
const HTML_ATTR_ESCAPE_REGEX = /[&<>"']/g;
const HTML_ATTR_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const HTML_TEXT_UNESCAPE_REGEX =
  /&(?:amp|lt|gt|quot|apos|#39|nbsp|copy|reg|trade|mdash|ndash|hellip|lsquo|rsquo|ldquo|rdquo|#\d+|#x[\da-f]+);/gi;
const HTML_TEXT_UNESCAPE_ENTITIES =
  "&amp;=&|&lt;=<|&gt;=>|&quot;=\"|&apos;='|&#39;='|&nbsp;=\u00a0|&copy;=\u00a9|&reg;=\u00ae|&trade;=\u2122|&mdash;=\u2014|&ndash;=\u2013|&hellip;=\u2026|&lsquo;=\u2018|&rsquo;=\u2019|&ldquo;=\u201c|&rdquo;=\u201d";
const HTML_TEXT_UNESCAPE_MAP: Record<string, string> = Object.fromEntries(
  HTML_TEXT_UNESCAPE_ENTITIES.split('|').map((entry) => {
    const separatorIndex = entry.indexOf('=');
    return [entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)];
  })
);

function escapeHtmlAttr(value: string): string {
  if (!value) return '';
  return value.replace(
    HTML_ATTR_ESCAPE_REGEX,
    (match) => HTML_ATTR_ESCAPE_MAP[match] ?? match
  );
}

function readHtmlTagAttribute(
  tag: string,
  attributeName: string
): string | null {
  const openTagMatch = /^<\s*[a-z][a-z0-9-]*/i.exec(tag);
  if (!openTagMatch) {
    return null;
  }

  const targetName = attributeName.toLowerCase();
  let index = openTagMatch[0].length;

  while (index < tag.length) {
    while (index < tag.length && /\s/.test(tag[index] ?? '')) {
      index += 1;
    }

    const char = tag[index];
    if (!char || char === '>' || (char === '/' && tag[index + 1] === '>')) {
      break;
    }

    const nameStart = index;
    while (index < tag.length && !/[\s=/>]/.test(tag[index] ?? '')) {
      index += 1;
    }

    const name = tag.slice(nameStart, index).toLowerCase();

    while (index < tag.length && /\s/.test(tag[index] ?? '')) {
      index += 1;
    }

    let value = '';
    if (tag[index] === '=') {
      index += 1;
      while (index < tag.length && /\s/.test(tag[index] ?? '')) {
        index += 1;
      }

      const quote = tag[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        const valueStart = index;
        while (index < tag.length && tag[index] !== quote) {
          index += 1;
        }
        value = tag.slice(valueStart, index);
        if (tag[index] === quote) {
          index += 1;
        }
      } else {
        const valueStart = index;
        while (index < tag.length && !/[\s>]/.test(tag[index] ?? '')) {
          index += 1;
        }
        value = tag.slice(valueStart, index);
      }
    }

    if (name === targetName) {
      return value;
    }
  }

  return null;
}

export function unescapeHtmlText(value: string): string {
  if (!value) return '';
  return value.replace(HTML_TEXT_UNESCAPE_REGEX, (match) => {
    const normalizedMatch = match.toLowerCase();
    const mapped = HTML_TEXT_UNESCAPE_MAP[normalizedMatch];
    if (mapped !== undefined) {
      return mapped;
    }

    if (normalizedMatch.startsWith('&#x')) {
      const codePoint = Number.parseInt(normalizedMatch.slice(3, -1), 16);
      return Number.isInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }

    if (normalizedMatch.startsWith('&#')) {
      const codePoint = Number.parseInt(normalizedMatch.slice(2, -1), 10);
      return Number.isInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }

    return match;
  });
}

function normalizeBasePath(basePath: string): string {
  return !basePath || basePath === '/' ? '' : basePath.replace(/\/+$/, '');
}

function tryParseJson(content: unknown): unknown | null {
  if (typeof content !== 'string') return content ?? null;

  try {
    return JSON.parse(content.trim());
  } catch {
    return null;
  }
}

function deriveAltFromImageSrc(src: string): string {
  const source = src.trim();
  if (!source) {
    return '';
  }

  let parsedPath = source;
  try {
    parsedPath = decodeURIComponent(new URL(source).pathname);
  } catch {
    parsedPath = source;
  }

  const fileName = parsedPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .pop();
  return fileName
    ? fileName
        .replace(/\.[a-z0-9]{2,8}$/i, '')
        .replace(/[-_](\d{2,5}x\d{2,5})$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

function ensureBlogImageAltText(
  html: string,
  fallbackAltText: string | null | undefined
): string {
  const fallbackText = fallbackAltText?.trim() || DEFAULT_BLOG_IMAGE_ALT;
  const fallback = fallbackText.slice(0, 200);

  return html.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const srcMatch = imgTag.match(/\bsrc\s*=\s*(['"])(.*?)\1/i);
    const derivedAlt = deriveAltFromImageSrc(srcMatch?.[2] ?? '');
    const altCandidate = (derivedAlt || fallback).slice(0, 200).trim();
    const escapedAlt = escapeHtmlAttr(altCandidate);
    const altAttrRegex = /\balt\s*=\s*(['"])(.*?)\1/i;
    const currentAltMatch = imgTag.match(altAttrRegex);
    const currentAlt = currentAltMatch?.[2];

    if (currentAlt !== undefined) {
      return imgTag;
    }

    if (/\/\s*>$/.test(imgTag)) {
      return imgTag.replace(/\/\s*>$/, ` alt="${escapedAlt}" />`);
    }

    return imgTag.replace(/>$/, ` alt="${escapedAlt}">`);
  });
}

function formatFigureAttributes(attributes: string | undefined): string {
  const trimmedAttributes = attributes?.trim();
  return trimmedAttributes ? ` ${trimmedAttributes}` : '';
}

function buildFigureFromTitledImage(
  imgTag: string,
  figureAttributes?: string
): string | null {
  const titleMatch = imgTag.match(/\btitle\s*=\s*(['"])(.*?)\1/i);
  const rawTitle = titleMatch?.[2] ?? '';
  const trimmedTitle = rawTitle.trim();
  if (!trimmedTitle) return null;

  // `trimmedTitle` contains sanitized HTML entities; decode with
  // `unescapeHtmlText(trimmedTitle)` to recover plain text, then encode again
  // with `escapeHtmlText(...)` so `captionText` is safe for figcaption text.
  const captionText = escapeHtmlText(unescapeHtmlText(trimmedTitle));
  const imageWithoutTitle = imgTag.replace(/\s*title\s*=\s*(['"]).*?\1/i, '');

  return `<figure${formatFigureAttributes(figureAttributes)}>${imageWithoutTitle}<figcaption>${captionText}</figcaption></figure>`;
}

function isStandaloneImageBoundaryTag(tagName: string | undefined): boolean {
  return !!tagName && STANDALONE_IMAGE_BOUNDARY_TAGS.has(tagName.toLowerCase());
}

function hasStandaloneImageBoundaryBefore(
  html: string,
  index: number
): boolean {
  const before = html.slice(0, index).trimEnd();
  if (!before) {
    return true;
  }

  return isStandaloneImageBoundaryTag(before.match(HTML_TAG_AT_END_REGEX)?.[1]);
}

function hasStandaloneImageBoundaryAfter(html: string, index: number): boolean {
  const after = html.slice(index).trimStart();
  if (!after) {
    return true;
  }

  return isStandaloneImageBoundaryTag(
    after.match(HTML_TAG_AT_START_REGEX)?.[1]
  );
}

function isStandaloneImageBlock(
  html: string,
  imageStart: number,
  imageLength: number
): boolean {
  return (
    hasStandaloneImageBoundaryBefore(html, imageStart) &&
    hasStandaloneImageBoundaryAfter(html, imageStart + imageLength)
  );
}

export function transformImageTitlesToFigureCaptions(html: string): string {
  const withStandaloneFigures = html.replace(
    /<figure\b([^>]*)>\s*(<img\b[^<>]*>)\s*<\/figure>/gi,
    (figure, figureAttributes, imgTag) => {
      return buildFigureFromTitledImage(imgTag, figureAttributes) ?? figure;
    }
  );

  const withStandaloneImageParagraphs = withStandaloneFigures.replace(
    /<p\b([^>]*)>\s*(<img\b[^<>]*>)\s*<\/p>/gi,
    (paragraph, paragraphAttributes, imgTag) => {
      return (
        buildFigureFromTitledImage(imgTag, paragraphAttributes) ?? paragraph
      );
    }
  );

  return withStandaloneImageParagraphs.replace(
    /(<p\b[^>]*>[\s\S]*?<\/p>)|(<img\b[^<>]*>)/gi,
    (match, paragraph, imgTag, offset, fullHtml) => {
      if (paragraph) {
        return paragraph;
      }

      if (!imgTag) {
        return match;
      }

      if (!isStandaloneImageBlock(fullHtml, offset, imgTag.length)) {
        return match;
      }

      return buildFigureFromTitledImage(imgTag) ?? match;
    }
  );
}

function stripHtmlAttribute(tag: string, attributeName: string): string {
  const openTagMatch = /^<\s*[a-z][a-z0-9-]*/i.exec(tag);
  if (!openTagMatch) {
    return tag;
  }

  const targetName = attributeName.toLowerCase();
  let index = openTagMatch[0].length;
  let nextTag = tag.slice(0, index);

  while (index < tag.length) {
    const segmentStart = index;

    while (index < tag.length && /\s/.test(tag[index] ?? '')) {
      index += 1;
    }

    const char = tag[index];
    if (!char || char === '>' || (char === '/' && tag[index + 1] === '>')) {
      nextTag += tag.slice(segmentStart);
      break;
    }

    const nameStart = index;
    while (index < tag.length && !/[\s=/>]/.test(tag[index] ?? '')) {
      index += 1;
    }

    if (index === nameStart) {
      nextTag += tag.slice(segmentStart);
      break;
    }

    const name = tag.slice(nameStart, index).toLowerCase();

    while (index < tag.length && /\s/.test(tag[index] ?? '')) {
      index += 1;
    }

    if (tag[index] === '=') {
      index += 1;
      while (index < tag.length && /\s/.test(tag[index] ?? '')) {
        index += 1;
      }

      const quote = tag[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        while (index < tag.length && tag[index] !== quote) {
          index += 1;
        }
        if (tag[index] === quote) {
          index += 1;
        }
      } else {
        while (index < tag.length && !/[\s>]/.test(tag[index] ?? '')) {
          index += 1;
        }
      }
    }

    if (name !== targetName) {
      nextTag += tag.slice(segmentStart, index);
    }
  }

  return nextTag;
}

function setHtmlAttribute(tag: string, attributeName: string, value: string) {
  const withoutAttribute = stripHtmlAttribute(tag, attributeName);
  const insertion = ` ${attributeName}="${value}"`;
  return withoutAttribute.replace(/\s*\/?>$/, (ending) => {
    return ending.startsWith('/') ? `${insertion} />` : `${insertion}>`;
  });
}

function readPositiveIntegerHtmlAttribute(
  tag: string,
  attributeName: string
): number | undefined {
  const value = readHtmlTagAttribute(tag, attributeName);
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readInlineImageDimensions(imgTag: string) {
  const width = readPositiveIntegerHtmlAttribute(imgTag, 'width');
  const height = readPositiveIntegerHtmlAttribute(imgTag, 'height');
  return width && height ? { height, width } : undefined;
}

function buildResponsiveInlineImageTag(
  imgTag: string,
  siblings: ReturnType<typeof buildInlineImageSiblings>,
  { isFirstBodyImage = false }: { isFirstBodyImage?: boolean } = {}
): string {
  let nextTag = stripHtmlAttribute(imgTag, 'fetchpriority');
  const originalSrc = readHtmlTagAttribute(imgTag, 'src');
  const attributes = {
    ...(originalSrc ? { 'data-original-src': originalSrc } : {}),
    src: siblings.fallback,
    srcset: siblings.fallbackSrcSet,
    sizes: siblings.sizes,
    ...(siblings.width ? { width: String(siblings.width) } : {}),
    ...(siblings.height ? { height: String(siblings.height) } : {}),
    loading: isFirstBodyImage ? 'eager' : 'lazy',
    decoding: isFirstBodyImage ? 'sync' : 'async',
    ...(isFirstBodyImage
      ? { 'data-baci-priority-image': 'true', fetchpriority: 'high' }
      : {}),
  };

  for (const [attributeName, value] of Object.entries(attributes)) {
    nextTag = setHtmlAttribute(nextTag, attributeName, value);
  }

  return nextTag;
}

function isInsidePictureTag(html: string, innerStart: number): boolean {
  const openTagPattern = /<picture(?:\s|>)/gi;
  let openStart = -1;
  for (
    let match = openTagPattern.exec(html);
    match;
    match = openTagPattern.exec(html)
  ) {
    if (match.index > innerStart) break;
    openStart = match.index;
  }
  if (openStart === -1) return false;

  const previousClose = html.lastIndexOf('</picture>', innerStart);
  return previousClose < openStart;
}

/**
 * Wraps trusted CDN inline `<img>` tags in a `<picture>` that prefers the
 * pre-generated AVIF/WebP siblings, keeping the original `<img>` as the fallback
 * for clients without a usable `<source>`.
 * Runs AFTER sanitization (the sources are derived from already-sanitized,
 * trusted-CDN URLs); `<picture>`/`<source>` are allowlisted in sanitize.ts so
 * they survive SafeHtml's re-sanitization. External, non-inline, and legacy
 * inline images without the generated-sibling filename marker are left untouched.
 */
export function wrapTrustedCdnInlineImagesInPicture(
  html: string,
  {
    prioritizeFirstBodyImage = true,
  }: { prioritizeFirstBodyImage?: boolean } = {}
): string {
  // Quote-aware <img> match: tolerate a literal `>` inside a quoted attribute
  // value (e.g. alt text) instead of truncating on the first `>`.
  let bodyImageIndex = 0;

  return html.replace(
    /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,
    (imgTag, offset: number) => {
      const src = readHtmlTagAttribute(imgTag, 'src');
      if (src) {
        bodyImageIndex += 1;
      }

      if (!src || !isTrustedCdnInlineImage(src)) {
        return imgTag;
      }

      if (isInsidePictureTag(html, offset)) {
        return imgTag;
      }
      // `src` is captured from the already-sanitized HTML, so it is attribute-safe
      // (entities already escaped). Deriving siblings only appends `.avif`/`.webp`,
      // so the values stay correctly escaped — re-escaping here would double-encode
      // ampersands in any query string (`&amp;` -> `&amp;amp;`).
      const siblings = buildInlineImageSiblings(
        src,
        readInlineImageDimensions(imgTag)
      );
      const fallbackImg = buildResponsiveInlineImageTag(imgTag, siblings, {
        isFirstBodyImage: prioritizeFirstBodyImage && bodyImageIndex === 1,
      });
      return (
        '<picture>' +
        `<source srcset="${siblings.avifSrcSet}" sizes="${siblings.sizes}" type="image/avif" />` +
        `<source srcset="${siblings.webpSrcSet}" sizes="${siblings.sizes}" type="image/webp" />` +
        `${fallbackImg}</picture>`
      );
    }
  );
}

type ResolveBlogPostContentOptions = NormalizeStorefrontContentHrefOptions & {
  fallbackImageAlt?: string | null;
  /**
   * True when the page shell has already emitted an above-the-fold hero image
   * candidate, including a fallback placeholder. This keeps legacy body images
   * lazy so browsers receive a single high-priority image candidate per page.
   */
  hasPreloadedHeroImage?: boolean;
};

export async function resolveBlogPostContent(
  content: unknown,
  options: ResolveBlogPostContentOptions = {}
) {
  const contentStr =
    typeof content === 'string'
      ? content
      : content && typeof content === 'object'
        ? JSON.stringify(content)
        : '';
  const trimmedContent = contentStr.trim();
  const parsedJson = tryParseJson(content);
  const renderedContent =
    parsedJson !== null && typeof parsedJson === 'object'
      ? parsedJson
      : content;
  const isJson =
    renderedContent !== null && typeof renderedContent === 'object';
  const isHtml = trimmedContent.startsWith('<');

  let legacyHtml = '';
  if (!isJson) {
    const rawHtml = isHtml ? contentStr : await marked(contentStr || '');
    const rewrittenHtml = rewriteHtmlStorefrontHrefs(rawHtml, options);
    const sanitizedHtml = sanitizeHtml(rewrittenHtml);
    const captionedHtml = transformImageTitlesToFigureCaptions(sanitizedHtml);
    const altedHtml = ensureBlogImageAltText(
      captionedHtml,
      options.fallbackImageAlt
    );
    legacyHtml = wrapTrustedCdnInlineImagesInPicture(altedHtml, {
      prioritizeFirstBodyImage: !options.hasPreloadedHeroImage,
    });
  }

  return {
    contentStr,
    isJson,
    legacyHtml,
    renderedContent,
  };
}

export function buildCanonicalBlogPostUrl(
  merchant: { slug: string; custom_domain?: string },
  postSlug: string
): string {
  return `${buildStoreUrl(merchant)}/blog/${postSlug}`;
}

export function buildBlogUrl(
  baseUrl: string,
  basePath: string,
  postSlug?: string
): string {
  const blogUrl = `${baseUrl}${normalizeBasePath(basePath)}/blog`;
  return postSlug ? `${blogUrl}/${postSlug}` : blogUrl;
}
