// Template preview
import type React from 'react';
import { Suspense } from 'react';
import type { Product } from '../types';
import { DeferredShellFeature } from '../components/deferred-shell-feature';
import { BannerCarousel } from '../components/BannerCarousel';
import { HomeProductGrid } from '../components/HomeProductGrid';
import { Hero } from '../components/Hero';
import {
  BANNER_CAROUSEL_MOUNT_DELAY_MS,
  DEFERRED_SHELL_MOUNT_DELAY_MS,
  HOMEPAGE_STRIP_AD_BOOT_DELAY_MS,
} from '../config/ads';

import { AdUnit } from '../components/AdUnit';

// Define the expected props
interface HomePageProps {
  storeSlug?: string;
  products?: Product[];
  categories?: { name: string; slug: string }[];
}

export const OgabasseyHomePage: React.FC<HomePageProps> = ({
  storeSlug,
  products,
}) => {
  return (
    <>
      <Hero />



      {/* Ad Placement: Homepage Strip */}
      <DeferredShellFeature
        timeoutMs={DEFERRED_SHELL_MOUNT_DELAY_MS}
        activateOnInteraction={false}
        activateOnIdle={false}
        fallback={(
          <div
            aria-hidden="true"
            className="max-w-[1400px] mx-auto px-4 md:px-6 py-4"
          >
            <div className="min-h-[120px] rounded-2xl bg-gray-50/80 border border-gray-100/80 [content-visibility:auto] [contain-intrinsic-size:1400px_120px]" />
          </div>
        )}
      >
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4">
          <AdUnit
            placementKey="HOMEPAGE_STRIP"
            bootDelayMs={HOMEPAGE_STRIP_AD_BOOT_DELAY_MS}
          />
        </div>
      </DeferredShellFeature>

      {/* Horizontal Carousel Banner - Desktop Only */}
      <DeferredShellFeature
        timeoutMs={BANNER_CAROUSEL_MOUNT_DELAY_MS}
        activateOnInteraction={false}
        activateOnIdle={false}
        fallback={(
          <div
            aria-hidden="true"
            className="hidden md:block max-w-[1400px] mx-auto px-4 md:px-6 py-4 md:py-6"
          >
            <div className="h-40 md:h-52 rounded-3xl bg-gray-100/80 border border-gray-100 [content-visibility:auto] [contain-intrinsic-size:1400px_220px]" />
          </div>
        )}
      >
        <div className="hidden md:block max-w-[1400px] mx-auto px-4 md:px-6 py-4 md:py-6 [content-visibility:auto] [contain-intrinsic-size:1400px_220px]">
          <BannerCarousel className="h-40 md:h-52" />
        </div>
      </DeferredShellFeature>

      {/* Suspense boundary keeps the featured-products section non-blocking */}
      <Suspense>
        <HomeProductGrid
          storeSlug={storeSlug}
          products={products}
          initialDisplayCount={8}
          inlineAdBreakpoints={[12, 24]}
        />
      </Suspense>
    </>
  );
};
