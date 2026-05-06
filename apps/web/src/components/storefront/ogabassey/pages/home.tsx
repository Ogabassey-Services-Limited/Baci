// Template preview
import type React from 'react';
import { Suspense } from 'react';
import type { Product } from '../types';
import { DeferredAdUnit } from '../components/deferred-ad-unit';
import { DeferredBannerCarousel } from '../components/deferred-banner-carousel';
import { HomeProductGrid } from '../components/HomeProductGrid';
import { Hero } from '../components/Hero';
import {
  BANNER_CAROUSEL_MOUNT_DELAY_MS,
  DEFERRED_SHELL_MOUNT_DELAY_MS,
  HOMEPAGE_STRIP_AD_BOOT_DELAY_MS,
} from '../config/ads';

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
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4">
        <DeferredAdUnit
          fallback={
            <div
              aria-hidden="true"
              className="min-h-[120px] rounded-2xl bg-gray-50/80 border border-gray-100/80 [content-visibility:auto] [contain-intrinsic-size:1400px_120px]"
            />
          }
          placementKey="HOMEPAGE_STRIP"
          bootDelayMs={HOMEPAGE_STRIP_AD_BOOT_DELAY_MS}
          timeoutMs={DEFERRED_SHELL_MOUNT_DELAY_MS}
        />
      </div>

      {/* Horizontal Carousel Banner - Desktop Only */}
      <div className="hidden md:block max-w-[1400px] mx-auto px-4 md:px-6 py-4 md:py-6 [content-visibility:auto] [contain-intrinsic-size:1400px_220px]">
        <DeferredBannerCarousel
          className="h-40 md:h-52"
          fallback={
            <div
              aria-hidden="true"
              className="h-40 md:h-52 rounded-3xl bg-gray-100/80 border border-gray-100 [content-visibility:auto] [contain-intrinsic-size:1400px_220px]"
            />
          }
          timeoutMs={BANNER_CAROUSEL_MOUNT_DELAY_MS}
        />
      </div>

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
