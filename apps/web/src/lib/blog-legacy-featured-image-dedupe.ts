function normalizeHtmlImageUrl(value: string): string {
  return value.replace(/&amp;/g, '&').trim();
}

function findEnclosingTagRange(
  html: string,
  innerStart: number,
  innerEnd: number,
  tagName: 'p' | 'picture'
): { start: number; end: number } | null {
  const openTagPattern =
    tagName === 'p' ? /<p(?:\s|>)/gi : /<picture(?:\s|>)/gi;
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

function isOnlyWrapperContent(
  html: string,
  wrapper: { start: number; end: number },
  child: { start: number; end: number }
): boolean {
  const openingEnd = html.indexOf('>', wrapper.start);
  if (openingEnd === -1 || openingEnd >= child.start) return false;
  const beforeChild = html.slice(openingEnd + 1, child.start).trim();
  const afterChild = html
    .slice(child.end, wrapper.end)
    .replace(/<\/p>$/i, '')
    .trim();
  return beforeChild === '' && afterChild === '';
}

export function removeDuplicateLegacyFeaturedImage(
  html: string,
  featuredImageUrl: string | null | undefined
): string {
  const normalizedFeaturedUrl = featuredImageUrl?.trim();
  if (!normalizedFeaturedUrl) return html;

  const firstImage = html.match(/<img\b[^>]*\bsrc=(['"])(.*?)\1[^>]*>/i);
  if (!firstImage || firstImage.index === undefined) {
    return html;
  }

  const firstImageSrc = normalizeHtmlImageUrl(firstImage[2] ?? '');
  if (firstImageSrc !== normalizedFeaturedUrl) {
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
  const removalRange = pictureRange ?? imageRange;
  const paragraphRange = findEnclosingTagRange(
    html,
    removalRange.start,
    removalRange.end,
    'p'
  );
  const finalRange =
    paragraphRange && isOnlyWrapperContent(html, paragraphRange, removalRange)
      ? paragraphRange
      : removalRange;

  return `${html.slice(0, finalRange.start)}${html.slice(finalRange.end)}`;
}
