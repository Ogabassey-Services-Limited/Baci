import { getStorefrontPdpFirstSegmentGate } from '@/lib/storefront-pdp-first-segment-gate';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';

/**
 * Returns true only for the exact two-segment PDP shape whose category is a
 * PDP-capable segment and whose product slug is unsafe to forward into routing,
 * cache, and product-lookup work. Categories stay eligible for the App Router's
 * canonical-category redirect because they are only compared in memory there.
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

  return !evaluateStorefrontSlugSafety(contentSegments[1]).safe;
}
