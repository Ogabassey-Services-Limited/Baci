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
];

const PDP_HERO_WIDTH_QUALITY_PAIRS: readonly PrewarmWidthQualityPair[] =
  PDP_HERO_WIDTHS.map((width) => ({
    width,
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  }));

// Listing/grid card thumbnail (components/ProductCard.tsx), rendered with
// `sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"`. There is
// no shared width export for this surface, so these mirror the device-size
// buckets that `sizes` expression resolves to for common phone/tablet
// viewports. ProductCard renders without an explicit `quality` prop, so the
// custom loader falls back to `DEFAULT_IMAGE_QUALITY` — reuse that shared
// constant here so the primed variants stay in lockstep with what the loader
// actually requests.
const LISTING_CARD_WIDTH_QUALITY_PAIRS: readonly PrewarmWidthQualityPair[] = [
  { width: 384, quality: DEFAULT_IMAGE_QUALITY },
  { width: 640, quality: DEFAULT_IMAGE_QUALITY },
  { width: 750, quality: DEFAULT_IMAGE_QUALITY },
];

// Blog surfaces all render at BLOG_HERO_IMAGE_QUALITY: the post hero
// (preload width 1200), the listing featured story (preload width 750), and
// the listing grid cards (384/640/750 buckets). Passed explicitly by the
// blog post-write call sites via `widthQualityPairs` — blog pairs are NOT in
// the product default set, so product prewarms never spend their URL budget
// on blog-only variants (and vice versa). Retina tiers ≥1920 are omitted,
// the same trade-off the PDP set accepts.
export const BLOG_IMAGE_WIDTH_QUALITY_PAIRS: readonly PrewarmWidthQualityPair[] =
  [384, 640, 750, 1080, 1200].map((width) => ({
    width,
    quality: BLOG_HERO_IMAGE_QUALITY,
  }));

export const ALL_WIDTH_QUALITY_PAIRS: readonly PrewarmWidthQualityPair[] = [
  ...PDP_HERO_WIDTH_QUALITY_PAIRS,
  ...LISTING_CARD_WIDTH_QUALITY_PAIRS,
];
