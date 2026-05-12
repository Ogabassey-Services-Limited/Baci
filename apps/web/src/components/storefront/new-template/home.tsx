'use client';

import type React from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { BannerCarousel } from './banner-carousel';
import { Hero } from './hero';
import { EngineProductGrid } from './engine-product-grid';
import { Navbar } from './navbar';
import { SavedProvider } from './saved-context';

export const Home: React.FC = () => {
  const merchantContext = useMerchantSafe();
  const storeSlug = merchantContext?.merchant?.slug;

  return (
    <SavedProvider>
      <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-red-100 selection:text-red-900">
        <Navbar />
        {/* Spacer for fixed navbar - only on mobile */}
        <div className="h-[25px] md:h-0" />
        <main>
          <Hero />
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 mb-8 md:mb-4">
            <BannerCarousel />
          </div>
          <EngineProductGrid storeSlug={storeSlug} useMockData={!storeSlug} />
        </main>
      </div>
    </SavedProvider>
  );
};
