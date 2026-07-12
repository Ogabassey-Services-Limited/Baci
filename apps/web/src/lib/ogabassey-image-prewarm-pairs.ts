import { MOBILE_HERO_IMAGE_QUALITY } from '@/components/storefront/ogabassey/components/hero-mobile-image-config';
import { BLOG_HERO_IMAGE_QUALITY } from '@/components/storefront/ogabassey/config/blog-media';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_PRELOAD_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_HEADER_PRELOAD_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
} from '@/components/storefront/ogabassey/config/product-media';
import { DEFAULT_IMAGE_QUALITY } from '@/config/cdn';

export interface PrewarmWidthQualityPair {
  quality: number;
  width: number;
}

// PDP hero: the width candidates next/image ACTUALLY emits for the hero's
// `sizes` expression against the configured `deviceSizes`, all at the shared
// OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY — every PDP surface (resource-hint
// preload, LCP skeleton, critical shell, hydrated gallery) renders at that
// one quality; the q30 "mobile pipeline" (buildOgabasseyPdpMobileImageSrcSet
// + the profile redirect route) has NO production consumer, so warming its
// variants primed URLs no visitor ever requested while the real LCP variant
// (width=750,quality=35 per live PSI traces) stayed cold. Widths: 750 (DPR-2
// ~390px phones), 828/1080 (Lighthouse + common Androids — see
// OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_HEADER_PRELOAD_WIDTH), 1200 (DPR-3
// phones + DPR-2 desktop 560px slot), 640 (DPR-1 desktop preload width).
const PDP_HERO_WIDTHS: readonly number[] = [
  OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_PRELOAD_WIDTH,
  750,
  828,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_HEADER_PRELOAD_WIDTH,
  1200,
  // Selectable since deviceSizes gained the 1440 tier: sub-768px CSS widths
  // at DPR 2 (e.g. 720px tablets/foldables) resolve calc(100vw - 32px) here.
  1440,
];

const PDP_HERO_WIDTH_QUALITY_PAIRS: readonly PrewarmWidthQualityPair[] =
  PDP_HERO_WIDTHS.map((width) => ({
    width,
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  }));

// Quality-less card surfaces (ProductCard, BlogSnippet) fall back to the
// loader's DEFAULT_IMAGE_QUALITY across the full responsive ladder: their
// `sizes` expressions (50vw/33vw/25vw product cards, 100vw-mobile blog
// snippets) resolve to buckets ABOVE 750 on DPR-2/3 phones, tablets and wide
// desktops (e.g. 33vw × DPR-3 tablet → 1080; 25vw × 2560px DPR-2 → 1440), so
// stopping at 750 would leave real production card URLs unchecked and
// unwarmed.
const CARD_DEFAULT_QUALITY_WIDTHS: readonly number[] = [
  384, 640, 750, 828, 1080, 1200, 1440,
];

const LISTING_CARD_WIDTH_QUALITY_PAIRS: readonly PrewarmWidthQualityPair[] =
  CARD_DEFAULT_QUALITY_WIDTHS.map((width) => ({
    width,
    quality: DEFAULT_IMAGE_QUALITY,
  }));

// Blog surfaces all render at BLOG_HERO_IMAGE_QUALITY: the post hero
// (preload width 1200), the listing featured story (preload width 750), and
// the listing grid cards (384/640/750 buckets). Passed explicitly by the
// blog post-write call sites via `widthQualityPairs` — blog pairs are NOT in
// the product default set, so product prewarms never spend their URL budget
// on blog-only variants (and vice versa). Retina tiers ≥1920 are omitted,
// the same trade-off the PDP set accepts.
const BLOG_HERO_WIDTHS: readonly number[] = [
  // 828/1440 joined the emitted set when deviceSizes gained those tiers: the
  // listing featured story is sizes="100vw" and the post hero is 100vw up to
  // 1200px, so DPR-2 414px phones pick 828 and DPR-3 ~480px phones pick 1440.
  384, 640, 750, 828, 1080, 1200, 1440,
];

// BlogSnippet (home/blog cross-links) renders featured images WITHOUT a
// quality prop — its 100vw-mobile sizes expression emits the same responsive
// ladder at the loader default quality as the product cards above.
export const BLOG_IMAGE_WIDTH_QUALITY_PAIRS: readonly PrewarmWidthQualityPair[] =
  [
    ...BLOG_HERO_WIDTHS.map((width) => ({
      width,
      quality: BLOG_HERO_IMAGE_QUALITY,
    })),
    ...CARD_DEFAULT_QUALITY_WIDTHS.map((width) => ({
      width,
      quality: DEFAULT_IMAGE_QUALITY,
    })),
  ];

// Home hero renders at MOBILE_HERO_IMAGE_QUALITY (70) across BOTH hero
// components, so every q70 variant was COLD after a purge/image change: the
// post-#3044 DebugBear waterfall measured the first `width=640,quality=70`
// fetch at ~5s (cold fill) while already-warm variants served in ~400ms.
// Warms the FULL responsive ladder next/image can emit for the hero, because
// the two components together span it across DPR 1–3:
//   - mobile carousel (hero-mobile-image-config): sizes '40vw' → next/image
//     filters allSizes ≥ deviceSizes[0]·0.40 = 256, so 256 is the FLOOR (the
//     app leaves `imageSizes` at Next's default [16…256,384], so 256 is a real
//     emitted bucket). A 320px viewport at DPR 2 resolves 40vw·2 = 256 → 256w;
//     larger phones at DPR 2–3 pick 384/640. Its <source> is capped at
//     max-width:767px, so the trailing 50vw branch never renders — desktop is
//     a separate component.
//   - desktop grid HeroBigImage (hero-desktop-grid): a FIXED
//     '(min-width:768px) 480px' slot. A px-only `sizes` carries no `vw`, so
//     next/image emits the full deviceSizes ladder (get-img-props getWidths)
//     and the browser resolves the 480px slot by DPR: the smallest candidate
//     ≥ 480·DPR — 640 (≤1.33×), 750 (1.5×), 828 (~1.6–1.7×), 1080 (2×/2.25×),
//     1200 (2.5× — real 250% Windows display scaling) and 1440 (3×). ALL are
//     reachable, so omitting any (e.g. an earlier drop of 256 or 1200) leaves
//     that DPR band's LCP cold after image updates. Retina tiers ≥1920 (DPR 4+)
//     are omitted, the same trade-off the PDP/blog sets accept.
// Kept OUT of ALL_WIDTH_QUALITY_PAIRS below and warmed by its OWN dedicated
// invocation (like BLOG_IMAGE_WIDTH_QUALITY_PAIRS) for the product's PRIMARY
// image only — the sole image the hero ever renders — so it never spends the
// shared product per-invocation URL budget (8 pairs × 3 formats = 24 URLs,
// far under the 120 cap).
export const HOME_HERO_IMAGE_WIDTH_QUALITY_PAIRS: readonly PrewarmWidthQualityPair[] =
  [256, 384, 640, 750, 828, 1080, 1200, 1440].map((width) => ({
    width,
    quality: MOBILE_HERO_IMAGE_QUALITY,
  }));

// Default matrix for PRODUCT image updates (PDP hero + listing card), applied
// to EVERY image of an updated product. The home-hero q70 tier is deliberately
// excluded (see above) so a multi-image product update keeps full PDP/card
// coverage within the 120-URL per-invocation budget.
export const ALL_WIDTH_QUALITY_PAIRS: readonly PrewarmWidthQualityPair[] = [
  ...PDP_HERO_WIDTH_QUALITY_PAIRS,
  ...LISTING_CARD_WIDTH_QUALITY_PAIRS,
];
