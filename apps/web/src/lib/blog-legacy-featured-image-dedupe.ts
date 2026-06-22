function normalizeHtmlImageUrl(value: string): string {
  return value.replace(/&amp;/g, '&').trim();
}

type WrapperTag = 'a' | 'figure' | 'p' | 'picture';

const FIRST_IMAGE_TAG_PATTERN =
  /<img\b(?:[^>"']|"[^"]*"|'[^']*')*\bsrc\s*=\s*(['"])(.*?)\1(?:[^>"']|"[^"]*"|'[^']*')*>/i;

function getOpeningTagPattern(tagName: WrapperTag): RegExp {
  switch (tagName) {
    case 'a':
      return /<a(?:\s|>)/gi;
    case 'figure':
      return /<figure(?:\s|>)/gi;
    case 'p':
      return /<p(?:\s|>)/gi;
    case 'picture':
      return /<picture(?:\s|>)/gi;
  }
}

function findEnclosingTagRange(
  html: string,
  innerStart: number,
  innerEnd: number,
  tagName: WrapperTag
): { start: number; end: number } | null {
  const openTagPattern = getOpeningTagPattern(tagName);
  let openStart = -1;
  for (
    let match = openTagPattern.exec(html);
    match;
    match = openTagPattern.exec(html)
  ) {
    if (match.index > innerStart) break;
    openStart = match.index;
  }
  if (openStart === -1) return null;

  const previousClose = html.lastIndexOf(`</${tagName}>`, innerStart);
  if (previousClose > openStart) return null;

  const closeStart = html.indexOf(`</${tagName}>`, innerEnd);
  if (closeStart === -1) return null;

  return { start: openStart, end: closeStart + tagName.length + 3 };
}

function stripClosingInlineWrapperTag(
  value: string,
  tagName: 'a' | 'p'
): string {
  switch (tagName) {
    case 'a':
      return value.replace(/<\/a>$/i, '');
    case 'p':
      return value.replace(/<\/p>$/i, '');
  }
}

function isOnlyWrapperContent(
  html: string,
  wrapper: { start: number; end: number },
  child: { start: number; end: number },
  tagName: 'a' | 'p'
): boolean {
  const openingEnd = html.indexOf('>', wrapper.start);
  if (openingEnd === -1 || openingEnd >= child.start) return false;
  const beforeChild = html.slice(openingEnd + 1, child.start).trim();
  const afterChild = stripClosingInlineWrapperTag(
    html.slice(child.end, wrapper.end),
    tagName
  ).trim();
  return beforeChild === '' && afterChild === '';
}

function isOnlyFigureContent(
  html: string,
  wrapper: { start: number; end: number },
  child: { start: number; end: number }
): boolean {
  const openingEnd = html.indexOf('>', wrapper.start);
  if (openingEnd === -1 || openingEnd >= child.start) return false;

  const beforeChild = html.slice(openingEnd + 1, child.start).trim();
  if (beforeChild !== '') return false;

  const afterChild = html
    .slice(child.end, wrapper.end)
    .replace(/<\/figure>$/i, '')
    .trim();

  return (
    afterChild === '' ||
    /^<figcaption\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*<\/figcaption>$/i.test(
      afterChild
    )
  );
}

export function removeDuplicateLegacyFeaturedImage(
  html: string,
  featuredImageUrl: string | null | undefined
): string {
  const normalizedFeaturedUrl = featuredImageUrl?.trim();
  if (!normalizedFeaturedUrl) return html;

  // Quote-aware first-<img> match so a literal `>` inside a quoted attribute
  // (e.g. alt text) does not truncate the matched tag range.
  const firstImage = html.match(FIRST_IMAGE_TAG_PATTERN);
  if (!firstImage || firstImage.index === undefined) {
    return html;
  }

  const firstImageSrc = normalizeHtmlImageUrl(firstImage[2] ?? '');
  const originalImageSrc = normalizeHtmlImageUrl(
    /\bdata-original-src\s*=\s*(['"])(.*?)\1/i.exec(firstImage[0])?.[2] ?? ''
  );
  if (
    firstImageSrc !== normalizedFeaturedUrl &&
    originalImageSrc !== normalizedFeaturedUrl
  ) {
    return html;
  }

  const imageRange = {
    start: firstImage.index,
    end: firstImage.index + firstImage[0].length,
  };
  const pictureRange = findEnclosingTagRange(
    html,
    imageRange.start,
    imageRange.end,
    'picture'
  );
  const imageOrPictureRange = pictureRange ?? imageRange;
  // Markdown image-links render the duplicated hero as `<a ...><img></a>`.
  // Expand through a link that wraps only the image/picture so it is removed too.
  const linkRange = findEnclosingTagRange(
    html,
    imageOrPictureRange.start,
    imageOrPictureRange.end,
    'a'
  );
  const linkOrImageRange =
    linkRange && isOnlyWrapperContent(html, linkRange, imageOrPictureRange, 'a')
      ? linkRange
      : imageOrPictureRange;
  const figureRange = findEnclosingTagRange(
    html,
    linkOrImageRange.start,
    linkOrImageRange.end,
    'figure'
  );
  const removalRange =
    figureRange && isOnlyFigureContent(html, figureRange, linkOrImageRange)
      ? figureRange
      : linkOrImageRange;
  const paragraphRange = findEnclosingTagRange(
    html,
    removalRange.start,
    removalRange.end,
    'p'
  );
  const finalRange =
    paragraphRange &&
    isOnlyWrapperContent(html, paragraphRange, removalRange, 'p')
      ? paragraphRange
      : removalRange;

  if (html.slice(0, finalRange.start).trim() !== '') {
    return html;
  }

  return `${html.slice(0, finalRange.start)}${html.slice(finalRange.end)}`;
}
