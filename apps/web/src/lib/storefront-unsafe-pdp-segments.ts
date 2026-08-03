import { getStorefrontPdpFirstSegmentGate } from '@/lib/storefront-pdp-first-segment-gate';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';

/**
 * Returns true only for the exact two-segment PDP shape whose category is a
 * PDP-capable segment and whose category or product slug is unsafe to forward
 * into routing, cache, and product-lookup work.
 */
export function hasUnsafeStorefrontPdpSegments(
  contentSegments: readonly string[],
  nonCacheableFirstSegments: ReadonlySet<string>
): boolean {
  if (contentSegments.length !== 2) {
    return false;
  }

  if (
    getStorefrontPdpFirstSegmentGate(contentSegments, nonCacheableFirstSegments)
      .isNonPdpFirstSegment
  ) {
    return false;
  }

  return contentSegments.some(
    (segment) => !evaluateStorefrontSlugSafety(segment).safe
  );
}
