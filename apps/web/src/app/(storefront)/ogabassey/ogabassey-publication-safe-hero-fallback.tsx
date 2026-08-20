import {
  HERO_MOBILE_CONTROLS_ROW_CLASSES,
  HERO_MOBILE_IMAGE_COLUMN_CLASSES,
  HERO_MOBILE_PANEL_CLASSES,
  HERO_MOBILE_PLAY_TOGGLE_SLOT_CLASSES,
  HERO_MOBILE_SLIDE_GRID_CLASSES,
  HERO_MOBILE_TEXT_COLUMN_CLASSES,
  HERO_MOBILE_UTILITY_PANEL_MIN_HEIGHT_CLASS,
  HERO_MOBILE_WRAPPER_CLASSES,
} from '@/components/storefront/ogabassey/components/hero-mobile-geometry';
import { MobileLcpHeroImage } from '@/components/storefront/ogabassey/components/mobile-lcp-hero-image';

interface OgabasseyPublicationSafeHeroFallbackProps {
  hasCarouselControls: boolean;
  /**
   * Slide-0's cached hero image URL. When present, the fallback paints the
   * decorative LCP image (via the same `MobileLcpHeroImage`/srcset/quality the
   * dynamic Hero uses, so the preload dedupes into one fetch), collapsing LCP
   * to FCP. This is IMAGE ONLY — `alt=""`, no product copy, prices, links, or
   * controls — the security boundary that keeps the request-scoped Hero the
   * sole owner of every shopping affordance. Absent (empty/cold feed) keeps the
   * inert skeleton so a stale shell never over-discloses.
   */
  heroImageUrl?: string | null;
}

export function OgabasseyPublicationSafeHeroFallback({
  hasCarouselControls,
  heroImageUrl,
}: OgabasseyPublicationSafeHeroFallbackProps) {
  return (
    <div
      aria-hidden="true"
      className="relative w-full bg-store-background"
      data-ogabassey-publication-safe-hero-fallback="true"
    >
      <div className="absolute top-0 right-0 left-0 z-0 h-28 bg-[var(--ogabassey-shell-background)] md:hidden" />
      <div className="relative z-10 mx-auto flex max-w-[1400px] flex-col px-4 pt-4 md:px-6 md:pt-6">
        <div className={HERO_MOBILE_WRAPPER_CLASSES}>
          {/* IMAGE ONLY. Slide-0's cached hero paints here so LCP lands at FCP;
              the request-scoped Hero (ogabassey-home-page-content.tsx) stays the
              sole owner of product copy, prices, PDP links, and controls. */}
          <div className={HERO_MOBILE_PANEL_CLASSES}>
            {heroImageUrl ? (
              <div className={HERO_MOBILE_SLIDE_GRID_CLASSES}>
                {/* Empty text column: reserves the real slide's 60% copy slot
                    while emitting NO product name, price, or CTA, so the image
                    paints in its true 40% (col-span-2) column. That matches the
                    image's `sizes` (no undersized/upscaled LCP frame) AND the
                    streamed Hero's geometry, so the Suspense swap causes no
                    resize/recomposition on the slow-mobile path this targets. */}
                <div className={HERO_MOBILE_TEXT_COLUMN_CLASSES} />
                <div className={HERO_MOBILE_IMAGE_COLUMN_CLASSES}>
                  <MobileLcpHeroImage
                    alt=""
                    imageFit="contain"
                    shouldPrioritizeImage
                    src={heroImageUrl}
                  />
                </div>
              </div>
            ) : null}
          </div>
          {hasCarouselControls ? (
            <div
              className={HERO_MOBILE_CONTROLS_ROW_CLASSES}
              data-ogabassey-publication-safe-carousel-controls="true"
            >
              <div className="h-11 flex-1" />
              <div className={HERO_MOBILE_PLAY_TOGGLE_SLOT_CLASSES} />
            </div>
          ) : null}
        </div>
        <div className="order-2 hidden h-[400px] grid-cols-1 gap-4 md:grid lg:h-[540px] lg:grid-cols-5">
          <div className="rounded-2xl bg-store-secondary ring-1 ring-store-border/70 lg:col-span-3" />
          <div className="hidden flex-col gap-4 lg:col-span-2 lg:flex">
            <div className="flex-1 rounded-2xl bg-store-secondary ring-1 ring-store-border/70" />
            <div className="flex-1 rounded-2xl bg-store-secondary ring-1 ring-store-border/70" />
          </div>
        </div>
      </div>
      <div className="mt-3 mb-6 w-full border-y border-store-border/60 md:mt-8 md:py-5">
        <div className="px-4 md:hidden">
          <div
            className={`${HERO_MOBILE_UTILITY_PANEL_MIN_HEIGHT_CLASS} rounded-3xl border border-store-border/60 bg-store-background`}
            data-ogabassey-publication-safe-utility-fallback="true"
          />
        </div>
        <div className="mx-auto hidden h-24 max-w-[1400px] rounded-lg bg-store-background px-6 md:block" />
      </div>
    </div>
  );
}
