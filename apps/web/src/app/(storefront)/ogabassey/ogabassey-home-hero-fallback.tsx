import { GadgetPattern } from '@/components/storefront/ogabassey/components/GadgetPattern';
import {
  HERO_MOBILE_CONTROL_TRACK_CLASSES,
  HERO_MOBILE_CONTROLS_ROW_CLASSES,
  HERO_MOBILE_CTA_CLASSES,
  HERO_MOBILE_EYEBROW_CLASSES,
  HERO_MOBILE_IMAGE_COLUMN_CLASSES,
  HERO_MOBILE_PANEL_CLASSES,
  HERO_MOBILE_PLAY_TOGGLE_SLOT_CLASSES,
  HERO_MOBILE_PRICE_CLASSES,
  HERO_MOBILE_SLIDE_GRID_CLASSES,
  HERO_MOBILE_TEXT_COLUMN_CLASSES,
  HERO_MOBILE_TITLE_CLASSES,
  HERO_MOBILE_WRAPPER_CLASSES,
} from '@/components/storefront/ogabassey/components/hero-mobile-geometry';
import type { LaunchProductSlide } from '@/components/storefront/ogabassey/components/LaunchCarousel';
import { MobileLcpHeroImage } from '@/components/storefront/ogabassey/components/mobile-lcp-hero-image';
import { OgabasseyShellMobileHero } from '@/components/storefront/ogabassey/components/ogabassey-shell-mobile-hero';

interface OgabasseyHomeHeroFallbackProps {
  /**
   * Cached slide data from `resolveOgabasseyHomeHeroShell`. When present the
   * fallback renders a server-only, non-hydrated mirror of the carousel's
   * slide-0 frame — pixel-identical geometry (shared class module) and the
   * SAME image URL as the streamed hero, so the Suspense swap is visually a
   * no-op and the LCP image is discoverable from the first flush. When null
   * (cold cache / degraded feed) it keeps the generic baked banner.
   */
  shellSlides?: LaunchProductSlide[] | null;
}

/**
 * Fallback for the product-driven home hero while the dynamic merchant/product
 * queries stream. With cached shell slides it mirrors the REAL slide-0 frame;
 * without them it degrades to geometry-only placeholders. Either way it is
 * `aria-hidden` server markup — no links, no client components, nothing that
 * could hydrate or double-instantiate carousel timers on slow streams.
 */
export function OgabasseyHomeHeroFallback({
  shellSlides,
}: OgabasseyHomeHeroFallbackProps = {}) {
  const slide = shellSlides?.[0] ?? null;

  return (
    <div
      aria-hidden="true"
      className="w-full bg-store-background relative"
      data-ogabassey-home-hero-fallback="true"
    >
      {/* Mirror Hero's #hero-bg-extension strip: the real hero paints a dark
          h-28 band behind the mobile panel; without it the swap flashes the
          page background. */}
      <div
        className="absolute top-0 left-0 right-0 h-28 overflow-hidden bg-[var(--ogabassey-shell-background)] z-0 md:hidden"
        data-ogabassey-mobile-hero-bg-extension="true"
      >
        <GadgetPattern opacity={0.1} />
      </div>
      <section className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10 pt-4 md:pt-6 flex flex-col">
        {slide ? (
          <div className={HERO_MOBILE_WRAPPER_CLASSES}>
            <div
              className={HERO_MOBILE_PANEL_CLASSES}
              data-ogabassey-shell-mobile-hero-slide="true"
            >
              <div
                className={`${HERO_MOBILE_SLIDE_GRID_CLASSES} opacity-100 z-10`}
              >
                <div className={HERO_MOBILE_TEXT_COLUMN_CLASSES}>
                  <span className={HERO_MOBILE_EYEBROW_CLASSES}>
                    Just launched
                  </span>
                  <h2 className={HERO_MOBILE_TITLE_CLASSES}>{slide.name}</h2>
                  <p className={HERO_MOBILE_PRICE_CLASSES}>
                    {slide.priceLabel}
                  </p>
                  <span className={HERO_MOBILE_CTA_CLASSES}>
                    {slide.ctaLabel}
                  </span>
                </div>
                <div className={HERO_MOBILE_IMAGE_COLUMN_CLASSES}>
                  <MobileLcpHeroImage
                    alt={slide.imageAlt}
                    imageFit="contain"
                    shouldPrioritizeImage
                    src={slide.imageUrl}
                  />
                </div>
              </div>
            </div>
            {(shellSlides?.length ?? 0) > 1 ? (
              // Reserve the controls row (dots + play toggle): the real hero
              // is ~52px taller with it — omitting it was a concrete slice of
              // the 0.37 swap CLS.
              <div className={HERO_MOBILE_CONTROLS_ROW_CLASSES}>
                {shellSlides?.map((controlSlide) => (
                  <div
                    className={HERO_MOBILE_CONTROL_TRACK_CLASSES}
                    key={controlSlide.id}
                  />
                ))}
                {/* Rendered unconditionally: the real carousel hides the play
                    toggle under prefers-reduced-motion, but the slot shares the
                    tracks' h-11 height, so the reduced-motion swap only shifts
                    width split — intentional, not a parity gap. */}
                <div
                  className={`${HERO_MOBILE_PLAY_TOGGLE_SLOT_CLASSES} bg-store-primary`}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="md:hidden order-1">
            <OgabasseyShellMobileHero />
          </div>
        )}
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-5 gap-4 h-auto lg:h-[540px] order-2">
          <div className="relative lg:col-span-3 h-[400px] lg:h-full overflow-hidden rounded-2xl ring-1 ring-store-border/70 shadow-lg bg-store-secondary grid grid-cols-5">
            <div className="col-span-3 flex flex-col justify-center gap-3 px-10 lg:px-16 py-8">
              <div className="h-3 w-28 rounded-full bg-store-primary/35" />
              <div className="h-12 w-4/5 rounded-2xl bg-store-secondary-text/10" />
              <div className="h-6 w-40 rounded-full bg-store-secondary-text/10" />
              <div className="mt-1 h-1.5 w-16 rounded-full bg-store-primary/50" />
              <div className="mt-3 h-12 w-40 rounded-full bg-store-primary/45" />
            </div>
            <div className="relative col-span-2 flex items-center justify-center p-8">
              <div className="h-56 w-36 rounded-[2rem] bg-store-secondary-text/10 ring-1 ring-store-border/60" />
            </div>
          </div>
          <div className="flex flex-col gap-4 h-full lg:col-span-2">
            {[0, 1].map((key) => (
              <div
                className="relative grid flex-1 grid-cols-5 overflow-hidden rounded-2xl shadow-lg ring-1 ring-store-border/70 bg-store-secondary"
                key={key}
              >
                <div className="col-span-3 flex flex-col justify-center gap-2 px-5 py-4">
                  <div className="h-2.5 w-24 rounded-full bg-store-primary/35" />
                  <div className="h-7 w-11/12 rounded-xl bg-store-secondary-text/10" />
                  <div className="h-4 w-24 rounded-full bg-store-secondary-text/10" />
                  <div className="mt-1 h-3 w-16 rounded-full bg-store-primary/35" />
                </div>
                <div className="relative col-span-2 flex items-center justify-center p-4">
                  <div className="h-28 w-20 rounded-2xl bg-store-secondary-text/10 ring-1 ring-store-border/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Mirror HeroUtilityPanel's real geometry (mt/py + py-8 banner boxes and
          the 5 utility buttons) so the cold-stream fallback reserves the panel's
          full height — a shorter spacer let content below shift down on resolve. */}
      <div className="w-full bg-store-background mt-3 md:mt-8 mb-6 border-y border-store-border/60 md:py-5">
        <div className="md:hidden px-4">
          <div className="bg-store-background rounded-3xl shadow-sm border border-store-border/60 p-2">
            <div className="bg-store-primary/5 rounded-2xl py-3 px-4 mb-4 flex justify-center">
              <div className="h-5 w-48 rounded-full bg-store-secondary-text/10" />
            </div>
            <div className="grid grid-cols-5 gap-2 px-1 pb-2">
              {[0, 1, 2, 3, 4].map((key) => (
                <div className="flex flex-col items-center gap-2" key={key}>
                  <div className="w-12 h-12 rounded-full bg-store-secondary-text/10" />
                  <div className="h-3 w-10 rounded-full bg-store-secondary-text/10" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="hidden md:flex max-w-[1400px] mx-auto px-4 md:px-6 flex-row items-center justify-between">
          <div className="bg-store-primary/5 px-10 py-8 rounded-lg min-w-[280px] flex justify-center">
            <div className="h-7 w-40 rounded-full bg-store-secondary-text/10" />
          </div>
          <div className="flex justify-center gap-8 md:gap-12 flex-wrap">
            {[0, 1, 2, 3, 4].map((key) => (
              <div className="flex flex-col items-center gap-2" key={key}>
                <div className="w-12 h-12 rounded-full bg-store-secondary-text/10" />
                <div className="h-3 w-10 rounded-full bg-store-secondary-text/10" />
              </div>
            ))}
          </div>
          <div className="hidden md:flex bg-store-primary/5 px-10 py-8 rounded-lg min-w-[280px] justify-center">
            <div className="h-7 w-40 rounded-full bg-store-secondary-text/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
