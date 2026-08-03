type StorefrontPdpFirstSegmentGate = {
  firstSegment: string;
  isProductsFallbackPdp: boolean;
  isNonPdpFirstSegment: boolean;
};

/**
 * Decode a raw URL path segment for routing comparisons without letting a
 * malformed percent escape crash the proxy. A bad sequence falls back to its
 * original value so callers can preserve their fail-open behavior.
 */
function safeDecodeStorefrontPathSegment(segment: string | undefined): string {
  if (!segment) {
    return '';
  }

  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Centralizes the PDP-category exception shared by the synchronous malformed
 * URL gate and the async crawl-budget preflight. `/products/{slug}` is a real
 * categoryless PDP; all other reserved/non-cacheable first segments are not.
 */
export function getStorefrontPdpFirstSegmentGate(
  contentSegments: readonly string[],
  nonCacheableFirstSegments: ReadonlySet<string>
): StorefrontPdpFirstSegmentGate {
  const firstSegment = safeDecodeStorefrontPathSegment(
    contentSegments[0]
  ).toLowerCase();
  const isProductsFallbackPdp = firstSegment === 'products';

  return {
    firstSegment,
    isProductsFallbackPdp,
    isNonPdpFirstSegment:
      !isProductsFallbackPdp &&
      (!firstSegment || nonCacheableFirstSegments.has(firstSegment)),
  };
}
