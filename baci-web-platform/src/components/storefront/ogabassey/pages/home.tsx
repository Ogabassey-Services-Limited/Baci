'use client';

// Template preview
import type React from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant';
import type { Product } from '@/lib/products';
import { BannerCarousel } from '../components/BannerCarousel';
import { EngineProductGrid } from '../components/EngineProductGrid';
import { Hero } from '../components/Hero';

import { AdUnit } from '../components/AdUnit';

// Define the expected props
interface HomePageProps {
  products?: Product[];
}

export const OgabasseyHomePage: React.FC<HomePageProps> = ({ products }) => {
  const merchantContext = useMerchantSafe();
  const storeSlug = merchantContext?.merchant?.slug;

  return (
    <>
      <h1 className="sr-only">
        {merchantContext?.merchant?.business_name || 'Shop'} - Buy Affordable New & UK Used Smartphones in Nigeria
      </h1>
      <Hero />



      {/* Ad Placement: Homepage Strip */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4">
        <AdUnit placementKey="HOMEPAGE_STRIP" />
      </div>

      {/* Horizontal Carousel Banner - Desktop Only */}
      <div className="hidden md:block max-w-[1400px] mx-auto px-4 md:px-6 py-4 md:py-6">
        <BannerCarousel className="h-40 md:h-52" />
      </div>

      <EngineProductGrid
        title="Featured Products"
        storeSlug={storeSlug}
        // If we have products from props, pass them to prevent client-side fetching
        externalProducts={products}
        useMockData={!storeSlug && !products}
      />
    </>
  );
};
