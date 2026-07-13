import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import {
  HERO_MOBILE_CONTROLS_ROW_CLASSES,
  HERO_MOBILE_PANEL_CLASSES,
  HERO_MOBILE_PLAY_TOGGLE_SLOT_CLASSES,
  HERO_MOBILE_UTILITY_PANEL_MIN_HEIGHT_CLASS,
  HERO_MOBILE_WRAPPER_CLASSES,
} from '@/components/storefront/ogabassey/components/hero-mobile-geometry';
import {
  OGABASSEY_DESCRIPTION,
  OGABASSEY_HOME_URL,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TITLE,
} from '@/config/ogabassey';
import { preloadOgabasseyHomeHeroResources } from './ogabassey-home-hero-resource-hints';
import { resolveOgabasseyHomeHeroShell } from './ogabassey-home-hero-shell-data';
import { OgabasseyHomePageContent } from './ogabassey-home-page-content';
import { OgabasseyHomeStyleLoader } from './ogabassey-home-style-loader';

interface OgabasseyStaticHomePageContentProps {
  /** Static per-route prefix for request-streamed storefront links: '' for the
   *  apex domain and '/ogabassey' for the path route. */
  pathPrefix: string;
}

function PublicationSafeHeroFallback({
  hasCarouselControls,
}: {
  hasCarouselControls: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="relative w-full bg-store-background"
      data-ogabassey-publication-safe-hero-fallback="true"
    >
      <div className="absolute top-0 right-0 left-0 z-0 h-28 bg-[var(--ogabassey-shell-background)] md:hidden" />
      <div className="relative z-10 mx-auto flex max-w-[1400px] flex-col px-4 pt-4 md:px-6 md:pt-6">
        <div className={HERO_MOBILE_WRAPPER_CLASSES}>
          <div className={HERO_MOBILE_PANEL_CLASSES} />
          {hasCarouselControls ? (
            <div className={HERO_MOBILE_CONTROLS_ROW_CLASSES}>
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

const ogabasseyStaticHomepageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: OGABASSEY_TITLE,
  description: OGABASSEY_DESCRIPTION,
  url: OGABASSEY_HOME_URL,
  isPartOf: {
    '@type': 'WebSite',
    name: 'OgaBassey',
    url: OGABASSEY_HOME_URL,
  },
  primaryImageOfPage: {
    '@type': 'ImageObject',
    url: OGABASSEY_SOCIAL_IMAGE_URL,
  },
} as const;

export async function OgabasseyStaticHomePageContent({
  pathPrefix,
}: OgabasseyStaticHomePageContentProps) {
  // Cached-only lookup (never request APIs — those stay in the dynamic
  // subtree). Slides are inert data here: only the request-scoped subtree may
  // turn them into shopping UI after it confirms the current publication
  // state. The slide-0 preload intentionally stays early for LCP discovery. In
  // the narrow stale-shell window it can disclose/fetch the formerly public
  // image URL, but it cannot render product UI or expose PDP navigation; the
  // visible surface is tenant- and publication-gated below.
  const heroShell = await resolveOgabasseyHomeHeroShell();
  const shellSlides =
    heroShell?.status === 'published' ? heroShell.slides : null;
  const shellMerchantId =
    heroShell?.status === 'published' ? heroShell.merchantId : null;
  if (shellSlides?.[0]) {
    preloadOgabasseyHomeHeroResources(shellSlides[0].imageUrl);
  }

  return (
    <>
      <JsonLd data={ogabasseyStaticHomepageSchema} />
      <OgabasseyHomeStyleLoader />
      {/* The fallback reserves the critical viewport without emitting product
          copy, images, links or controls. The sole shopping Hero is rendered
          only after the request-scoped publication guard succeeds. */}
      <Suspense
        fallback={
          shellSlides ? (
            <PublicationSafeHeroFallback
              hasCarouselControls={shellSlides.length > 1}
            />
          ) : null
        }
      >
        <OgabasseyHomePageContent
          pathPrefix={pathPrefix}
          shellMerchantId={shellMerchantId}
          shellSlides={shellSlides}
        />
      </Suspense>
    </>
  );
}
