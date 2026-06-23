import { marked } from 'marked';

export { getBlogPostTextPreview } from '@/lib/blog-utils';
export {
  transformImageTitlesToFigureCaptions,
  unescapeHtmlText,
} from './blog-post-image-html';
export { wrapTrustedCdnInlineImagesInPicture } from './blog-trusted-cdn-inline-images';

import { sanitizeHtml } from '@/lib/sanitize';
import { buildStoreUrl } from '@/lib/store-url';
import { rewriteHtmlStorefrontHrefs } from '@/lib/storefront-html-link-rewriting';
import type { NormalizeStorefrontContentHrefOptions } from '@/lib/storefront-link-normalization';
import {
  ensureBlogImageAltText,
  transformImageTitlesToFigureCaptions,
} from './blog-post-image-html';
import { wrapTrustedCdnInlineImagesInPictureWithMetadata } from './blog-trusted-cdn-inline-images';

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
  let legacyPriorityImageSources: string[] = [];
  if (!isJson) {
    const rawHtml = isHtml ? contentStr : await marked(contentStr || '');
    const rewrittenHtml = rewriteHtmlStorefrontHrefs(rawHtml, options);
    const sanitizedHtml = sanitizeHtml(rewrittenHtml);
    const captionedHtml = transformImageTitlesToFigureCaptions(sanitizedHtml);
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
