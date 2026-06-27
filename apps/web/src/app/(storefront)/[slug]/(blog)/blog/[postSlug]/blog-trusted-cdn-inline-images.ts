import {
  buildInlineImageSiblings,
  isLegacyOgabasseyCdnBlogImage,
  isTrustedCdnInlineImage,
} from '@/lib/blog-inline-image-optimization';
import {
  readHtmlTagAttribute,
  readPositiveIntegerHtmlAttribute,
  setHtmlAttribute,
  stripHtmlAttribute,
} from './blog-html-attribute-utils';

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
export type WrappedTrustedCdnInlineImages = {
  html: string;
  priorityImageSources: string[];
};

const HTML_IMG_TAG_PATTERN = /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const STANDALONE_IMAGE_WRAPPER_PATTERN =
  /<(p|figure)\b[^>]*>\s*(<img\b(?:[^>"']|"[^"]*"|'[^']*')*>)\s*<\/\1>/gi;

function hasLegacyOgabasseyCdnBlogImageCandidate(imgTag: string): boolean {
  if (isLegacyOgabasseyCdnBlogImage(readHtmlTagAttribute(imgTag, 'src'))) {
    return true;
  }

  const srcset = readHtmlTagAttribute(imgTag, 'srcset');
  return Boolean(
    srcset
      ?.split(',')
      .map((candidate) => candidate.trim().split(/\s+/)[0])
      .some(isLegacyOgabasseyCdnBlogImage)
  );
}

export function removeLegacyOgabasseyCdnBlogImages(html: string): string {
  const withoutStandaloneImageWrappers = html.replace(
    STANDALONE_IMAGE_WRAPPER_PATTERN,
    (wrapper, _tagName, imgTag) =>
      hasLegacyOgabasseyCdnBlogImageCandidate(imgTag) ? '' : wrapper
  );

  return withoutStandaloneImageWrappers.replace(
    HTML_IMG_TAG_PATTERN,
    (imgTag) => (hasLegacyOgabasseyCdnBlogImageCandidate(imgTag) ? '' : imgTag)
  );
}

export function wrapTrustedCdnInlineImagesInPictureWithMetadata(
  html: string,
  {
    prioritizeFirstBodyImage = true,
  }: { prioritizeFirstBodyImage?: boolean } = {}
): WrappedTrustedCdnInlineImages {
  // Quote-aware <img> match: tolerate a literal `>` inside a quoted attribute
  // value (e.g. alt text) instead of truncating on the first `>`.
  let bodyImageIndex = 0;
  const priorityImageSources: string[] = [];

  const wrappedHtml = html.replace(
    HTML_IMG_TAG_PATTERN,
    (imgTag, offset: number) => {
      const src = readHtmlTagAttribute(imgTag, 'src');
      if (hasLegacyOgabasseyCdnBlogImageCandidate(imgTag)) {
        return '';
      }

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
      const isFirstPriorityBodyImage =
        prioritizeFirstBodyImage && bodyImageIndex === 1;
      const fallbackImg = buildResponsiveInlineImageTag(imgTag, siblings, {
        isFirstBodyImage: isFirstPriorityBodyImage,
      });

      if (isFirstPriorityBodyImage) {
        priorityImageSources.push(siblings.fallback);
      }

      return (
        '<picture>' +
        `<source srcset="${siblings.avifSrcSet}" sizes="${siblings.sizes}" type="image/avif" />` +
        `<source srcset="${siblings.webpSrcSet}" sizes="${siblings.sizes}" type="image/webp" />` +
        `${fallbackImg}</picture>`
      );
    }
  );

  return { html: wrappedHtml, priorityImageSources };
}

export function wrapTrustedCdnInlineImagesInPicture(
  html: string,
  options: { prioritizeFirstBodyImage?: boolean } = {}
): string {
  return wrapTrustedCdnInlineImagesInPictureWithMetadata(html, options).html;
}
