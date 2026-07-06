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
      640, 750, 828, 1080, 1200, 1440,
    ]);
    expect(ALL_WIDTH_QUALITY_PAIRS.some((pair) => pair.quality === 30)).toBe(
      false
    );
  });

  it('warms listing cards at the loader default quality (ProductCard sets no quality prop)', () => {
    const listingPairs = ALL_WIDTH_QUALITY_PAIRS.filter(
      (pair) => pair.quality === DEFAULT_IMAGE_QUALITY
    );

    expect(listingPairs.map((pair) => pair.width)).toEqual([
      384, 640, 750, 828, 1080, 1200, 1440,
    ]);
  });

  it('covers blog hero widths at blog quality plus quality-less card buckets', () => {
    const heroPairs = BLOG_IMAGE_WIDTH_QUALITY_PAIRS.filter(
      (pair) => pair.quality === BLOG_HERO_IMAGE_QUALITY
    );
    const cardPairs = BLOG_IMAGE_WIDTH_QUALITY_PAIRS.filter(
      (pair) => pair.quality === DEFAULT_IMAGE_QUALITY
    );

    // Hero/featured surfaces are 100vw — 828 (DPR-2 414px) and 1440 (DPR-3
    // ~480px) became selectable when deviceSizes gained those tiers.
    expect(heroPairs.map((pair) => pair.width)).toEqual([
      384, 640, 750, 828, 1080, 1200, 1440,
    ]);
    // BlogSnippet renders without a quality prop → loader default quality,
    // across the full responsive ladder (100vw on mobile).
    expect(cardPairs.map((pair) => pair.width)).toEqual([
      384, 640, 750, 828, 1080, 1200, 1440,
    ]);
    // Blog pairs stay OUT of the product default set (per-invocation budget).
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
