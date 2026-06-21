// Template preview
import { LAUNCH_CAROUSEL_LIMIT } from '@baci/shared/storefront';
import type React from 'react';
import { Suspense } from 'react';
import { normalizeRouteBasePath } from '@/lib/routes';
import type { Product } from '../types';
import { buildLaunchSlides } from '../components/build-launch-slides';
import { DeferredAdUnit } from '../components/deferred-ad-unit';
import { HomeProductGrid } from '../components/HomeProductGrid';
import { Hero } from '../components/Hero';
import { LaunchCarousel } from '../components/LaunchCarousel';
import { HOMEPAGE_STRIP_AD_BOOT_DELAY_MS } from '../config/ads';

// Define the expected props
interface HomePageProps {
  basePath?: string;
  storeSlug?: string;
  products?: Product[];
  /** Newly-released / pinned launch devices, newest-first, pre-selected upstream. */
  launchProducts?: Product[];
  categories?: { name: string; slug: string }[];
  renderHero?: boolean;
}

export const OgabasseyHomePage: React.FC<HomePageProps> = ({
  basePath,
  storeSlug,
  products,
  launchProducts,
  renderHero = true,
}) => {
  const routeBasePath = normalizeRouteBasePath(
    basePath ?? (storeSlug ? `/${storeSlug}` : '')
  );
  // Prefer the upstream-selected launch products (pinned + newest); fall back to
  // the home product feed so callers that don't pass `launchProducts` (e.g. the
  // generic storefront renderer) still render a product carousel rather than an
  // empty slot now that the old promo banner is gone.
  const launchSlides = buildLaunchSlides(
    launchProducts ?? products ?? [],
    routeBasePath
  ).slice(0, LAUNCH_CAROUSEL_LIMIT);

  return (
    <>
      {renderHero && <Hero basePath={routeBasePath} />}

      {/* Ad Placement: Homepage Strip */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4">
        <DeferredAdUnit
          activateOnInteraction
          placementKey="HOMEPAGE_STRIP"
          bootDelayMs={HOMEPAGE_STRIP_AD_BOOT_DELAY_MS}
          timeoutMs={0}
        />
      </div>

      {/* Newly released devices — responsive (mobile + desktop), server-rendered
          so the product deep-links are crawlable; only the images lazy-load. */}
      {launchSlides.length > 0 ? (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 md:py-6 content-auto [contain-intrinsic-size:1400px_260px]">
          <LaunchCarousel slides={launchSlides} />
        </div>
      ) : null}

      {/* Suspense boundary keeps the featured-products section non-blocking */}
      <Suspense>
        <HomeProductGrid
          basePath={routeBasePath}
          storeSlug={storeSlug}
          products={products}
          initialDisplayCount={8}
          inlineAdBreakpoints={[12, 24]}
        />
      </Suspense>
    </>
  );
};
