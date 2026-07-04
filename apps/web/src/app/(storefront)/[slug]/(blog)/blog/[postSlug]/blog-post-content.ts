import { marked } from 'marked';

export { getBlogPostTextPreview } from '@/lib/blog-utils';
export {
  transformImageTitlesToFigureCaptions,
  unescapeHtmlText,
} from './blog-post-image-html';
export { wrapTrustedCdnInlineImagesInPicture } from './blog-trusted-cdn-inline-images';

import { sanitizeHtml } from '@/lib/sanitize';
import { buildStoreUrl } from '@/lib/store-url';
import { unwrapDeadHtmlAnchors } from '@/lib/storefront-html-anchor-unwrapping';
import { rewriteHtmlStorefrontHrefs } from '@/lib/storefront-html-link-rewriting';
import {
  type NormalizeStorefrontContentHrefOptions,
  normalizeStorefrontContentHref,
} from '@/lib/storefront-link-normalization';
import {
  ensureBlogImageAltText,
  transformImageTitlesToFigureCaptions,
} from './blog-post-image-html';
import {
  removeLegacyOgabasseyCdnBlogImages,
  wrapTrustedCdnInlineImagesInPictureWithMetadata,
} from './blog-trusted-cdn-inline-images';

function normalizeBasePath(basePath: string): string {
  return !basePath || basePath === '/' ? '' : basePath.replace(/\/+$/, '');
}

function isTipTapDocument(content: unknown): content is { type: 'doc' } {
  return (
    !!content &&
    typeof content === 'object' &&
    (content as { type?: unknown }).type === 'doc'
  );
}

function extractLeadingJsonPrefix(content: string): string | null {
  const firstContentIndex = content.search(/\S/);
  if (firstContentIndex === -1) return null;

  const firstCharacter = content[firstContentIndex];
  if (firstCharacter !== '{' && firstCharacter !== '[') return null;

  const closingStack: string[] = [];
  let inString = false;
  let isEscaped = false;

  for (let index = firstContentIndex; index < content.length; index += 1) {
    const character = content[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === '\\') {
        isEscaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      closingStack.push('}');
      continue;
    }

    if (character === '[') {
      closingStack.push(']');
      continue;
    }

    if (character !== '}' && character !== ']') {
      continue;
    }

    if (closingStack.pop() !== character) {
      return null;
    }

    if (closingStack.length === 0) {
      return content.slice(firstContentIndex, index + 1);
    }
  }

  return null;
}

function tryParseJson(content: unknown): unknown | null {
  if (typeof content !== 'string') return content ?? null;

  try {
    return JSON.parse(content.trim());
  } catch {
    const leadingJsonPrefix = extractLeadingJsonPrefix(content);
    if (!leadingJsonPrefix) return null;

    try {
      const parsedPrefix = JSON.parse(leadingJsonPrefix);
      return isTipTapDocument(parsedPrefix) ? parsedPrefix : null;
    } catch {
      return null;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stripNofollowToken(rel: string): string {
  return rel
    .split(/\s+/)
    .filter((token) => token && token.toLowerCase() !== 'nofollow')
    .join(' ');
}

function normalizeBlogContentLinkMark(
  mark: unknown,
  options: NormalizeStorefrontContentHrefOptions
): unknown {
  if (!isRecord(mark) || mark.type !== 'link' || !isRecord(mark.attrs)) {
    return mark;
  }

  const rawHref = mark.attrs.href;
  if (typeof rawHref !== 'string') {
    return mark;
  }

  const normalizedHref = normalizeStorefrontContentHref(rawHref, options);
  const nextAttrs: Record<string, unknown> = { ...mark.attrs };
  let changed = false;

  if (normalizedHref !== rawHref) {
    nextAttrs.href = normalizedHref;
    changed = true;
  }

  if (typeof nextAttrs.rel === 'string') {
    const normalizedRel = stripNofollowToken(nextAttrs.rel);
    if (normalizedRel) {
      if (normalizedRel !== nextAttrs.rel) {
        nextAttrs.rel = normalizedRel;
        changed = true;
      }
    } else {
      delete nextAttrs.rel;
      changed = true;
    }
  }

  return changed ? { ...mark, attrs: nextAttrs } : mark;
}

function normalizeBlogContentLinks(
  content: unknown,
  options: NormalizeStorefrontContentHrefOptions
): unknown {
  if (!isRecord(content)) {
    return content;
  }

  const nextContent: Record<string, unknown> = { ...content };
  let changed = false;

  if (Array.isArray(content.content)) {
    const normalizedChildren = content.content.map((child) => {
      const normalizedChild = normalizeBlogContentLinks(child, options);
      changed ||= normalizedChild !== child;
      return normalizedChild;
    });

    if (changed) {
      nextContent.content = normalizedChildren;
    }
  }

  if (Array.isArray(content.marks)) {
    let marksChanged = false;
    const normalizedMarks = content.marks.map((mark) => {
      const normalizedMark = normalizeBlogContentLinkMark(mark, options);
      marksChanged ||= normalizedMark !== mark;
      return normalizedMark;
    });

    if (marksChanged) {
      nextContent.marks = normalizedMarks;
      changed = true;
    }
  }

  return changed ? nextContent : content;
}

type ResolveBlogPostContentOptions = NormalizeStorefrontContentHrefOptions & {
  fallbackImageAlt?: string | null;
  /**
   * True when the page shell has already emitted an above-the-fold hero image
   * candidate, including a fallback placeholder. This keeps legacy body images
   * lazy so browsers receive a single high-priority image candidate per page.
   */
  hasPreloadedHeroImage?: boolean;
  /**
   * When provided, anchors whose normalized href is reported dead (e.g. blog
   * posts still in draft, products that don't exist) are unwrapped to plain
   * text instead of rendering a 404 link.
   */
  isDeadHref?: (href: string) => boolean;
  /**
   * When provided, anchors whose href resolves through a permanent redirect
   * (renamed posts, consolidated/re-categorized products) are rewritten to the
   * canonical target instead of emitting a redirecting link. Runs before
   * isDeadHref.
   */
  rewriteHref?: (href: string) => string | null;
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
  const rawRenderedContent =
    parsedJson !== null && typeof parsedJson === 'object'
      ? parsedJson
      : content;
  const renderedContent =
    rawRenderedContent !== null && typeof rawRenderedContent === 'object'
      ? normalizeBlogContentLinks(rawRenderedContent, options)
      : rawRenderedContent;
  const isJson =
    renderedContent !== null && typeof renderedContent === 'object';
  const isHtml = trimmedContent.startsWith('<');

  let legacyHtml = '';
  let legacyPriorityImageSources: string[] = [];
  if (!isJson) {
    const rawHtml = isHtml ? contentStr : await marked(contentStr || '');
    const rewrittenHtml = rewriteHtmlStorefrontHrefs(rawHtml, options);
    const liveLinkHtml =
      options.isDeadHref || options.rewriteHref
        ? unwrapDeadHtmlAnchors(
            rewrittenHtml,
            options.isDeadHref ?? (() => false),
            options.rewriteHref
          )
        : rewrittenHtml;
    const sanitizedHtml = sanitizeHtml(liveLinkHtml, {
      stripNofollowFromLinks: true,
    });
    const legacyImageSafeHtml =
      removeLegacyOgabasseyCdnBlogImages(sanitizedHtml);
    const captionedHtml =
      transformImageTitlesToFigureCaptions(legacyImageSafeHtml);
    const altedHtml = ensureBlogImageAltText(
      captionedHtml,
      options.fallbackImageAlt
    );
    const wrappedContent = wrapTrustedCdnInlineImagesInPictureWithMetadata(
      altedHtml,
      {
        prioritizeFirstBodyImage: !options.hasPreloadedHeroImage,
      }
    );
    legacyHtml = wrappedContent.html;
    legacyPriorityImageSources = wrappedContent.priorityImageSources;
  }

  return {
    contentStr,
    isJson,
    legacyHtml,
    legacyPriorityImageSources,
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
