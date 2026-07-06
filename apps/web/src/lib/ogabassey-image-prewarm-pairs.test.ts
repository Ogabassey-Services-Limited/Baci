import { describe, expect, it } from 'vitest';
import { BLOG_HERO_IMAGE_QUALITY } from '@/components/storefront/ogabassey/config/blog-media';
import { OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY } from '@/components/storefront/ogabassey/config/product-media';
import { DEFAULT_IMAGE_QUALITY } from '@/config/cdn';
import {
  ALL_WIDTH_QUALITY_PAIRS,
  BLOG_IMAGE_WIDTH_QUALITY_PAIRS,
} from './ogabassey-image-prewarm-pairs';

describe('ogabassey image prewarm pair matrices', () => {
  it('warms the PDP hero variants production actually requests (shared q35, no orphaned q30 tier)', () => {
    // The real PDP LCP request observed in live PSI traces is
    // width=750,quality=35 — the matrix must contain it, and must contain NO
    // q30 pair: the q30 "mobile pipeline" has no production consumer, so a
    // q30 entry means the prewarm is priming URLs nobody requests.
    const pdpPairs = ALL_WIDTH_QUALITY_PAIRS.filter(
      (pair) => pair.quality === OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY
    );

    expect(pdpPairs.map((pair) => pair.width)).toEqual([
      640, 750, 828, 1080, 1200,
    ]);
    expect(ALL_WIDTH_QUALITY_PAIRS.some((pair) => pair.quality === 30)).toBe(
      false
    );
  });

  it('warms listing cards at the loader default quality (ProductCard sets no quality prop)', () => {
    const listingPairs = ALL_WIDTH_QUALITY_PAIRS.filter(
      (pair) => pair.quality === DEFAULT_IMAGE_QUALITY
    );

    expect(listingPairs.map((pair) => pair.width)).toEqual([384, 640, 750]);
  });

  it('keeps blog pairs OUT of the product default set and at the blog quality', () => {
    // Product prewarms must never spend their per-invocation URL budget on
    // blog-only variants — blog call sites pass this set explicitly.
    for (const pair of BLOG_IMAGE_WIDTH_QUALITY_PAIRS) {
      expect(pair.quality).toBe(BLOG_HERO_IMAGE_QUALITY);
    }
    expect(BLOG_IMAGE_WIDTH_QUALITY_PAIRS.map((pair) => pair.width)).toEqual([
      384, 640, 750, 1080, 1200,
    ]);
    expect(
      ALL_WIDTH_QUALITY_PAIRS.some(
        (pair) => pair.quality === BLOG_HERO_IMAGE_QUALITY
      )
    ).toBe(false);
  });

  it('contains no duplicate width×quality entries (each warms a distinct URL)', () => {
    const keys = ALL_WIDTH_QUALITY_PAIRS.map(
      (pair) => `${pair.width}x${pair.quality}`
    );

    expect(new Set(keys).size).toBe(keys.length);
  });
});
