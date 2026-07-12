import { describe, expect, it } from 'vitest';
import { BLOG_HERO_IMAGE_QUALITY } from '@/components/storefront/ogabassey/config/blog-media';
import { OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY } from '@/components/storefront/ogabassey/config/product-media';
import { DEFAULT_IMAGE_QUALITY } from '@/config/cdn';
import {
  ALL_WIDTH_QUALITY_PAIRS,
  BLOG_IMAGE_WIDTH_QUALITY_PAIRS,
  HOME_HERO_IMAGE_WIDTH_QUALITY_PAIRS,
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
  it('warms the home-hero q70 tier across the full ladder both hero components emit', () => {
    // Home hero renders at MOBILE_HERO_IMAGE_QUALITY (70) across two components
    // that together span the responsive ladder over DPR 1–3:
    //   - mobile carousel: sizes '40vw' → floor is 256 (imageSizes default
    //     includes 256; a 320px viewport at DPR 2 picks 256w), then 384/640.
    //   - desktop grid HeroBigImage: a fixed '(min-width:768px) 480px' slot. A
    //     px-only `sizes` emits the full deviceSizes ladder; the 480px slot
    //     resolves by DPR (smallest candidate ≥ 480·DPR) to 640/750/828/1080/
    //     1200/1440 — including 1200 at 2.5× (real 250% Windows display
    //     scaling). Every reachable band must be warmed or its LCP stays cold.
    expect(
      HOME_HERO_IMAGE_WIDTH_QUALITY_PAIRS.map((pair) => pair.width).sort(
        (a, b) => a - b
      )
    ).toEqual([256, 384, 640, 750, 828, 1080, 1200, 1440]);
    expect(
      HOME_HERO_IMAGE_WIDTH_QUALITY_PAIRS.every((pair) => pair.quality === 70)
    ).toBe(true);
  });

  it('keeps the home-hero q70 tier OUT of the shared product default matrix', () => {
    // The q70 tier rides its own dedicated prewarm invocation (warmed for the
    // primary image only). Leaking it into ALL_WIDTH_QUALITY_PAIRS would spend
    // the shared per-image budget on variants only the home hero uses.
    expect(ALL_WIDTH_QUALITY_PAIRS.some((pair) => pair.quality === 70)).toBe(
      false
    );
  });

  it('lets a three-image product update fit one prewarm invocation budget', () => {
    // buildPrewarmUrls slices at MAX_PREWARM_URLS_PER_INVOCATION (120) and each
    // pair expands into 3 format tiers (fallback + avif + auto). The product
    // default matrix must let a 3-image update warm every image completely —
    // the regression this guards against is the home-hero tier inflating the
    // matrix until the third image's URLs are truncated.
    const urlsForThreeImages = ALL_WIDTH_QUALITY_PAIRS.length * 3 * 3;
    expect(urlsForThreeImages).toBeLessThanOrEqual(120);
  });
});
