// @ts-nocheck - Template preview
import type React from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { BannerCarousel } from '../components/BannerCarousel';
import { Hero } from '../components/Hero';
import { EngineProductGrid } from '../components/EngineProductGrid';

export const OgabasseyV2HomePage: React.FC = () => {
  const merchantContext = useMerchantSafe();
  const storeSlug = merchantContext?.merchant?.slug;

  return (
    <>
      <Hero />

      {/* Horizontal Carousel Banner */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 mb-6">
        <BannerCarousel className="h-40 md:h-52" />
      </div>

      <EngineProductGrid
        title="Featured Products"
        storeSlug={storeSlug}
        useMockData={!storeSlug}
      />
    </>
  );
};
