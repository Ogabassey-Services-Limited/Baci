'use client';

// @ts-nocheck - Template preview
import type React from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { BannerCarousel } from '../components/BannerCarousel';
import { Hero } from '../components/Hero';
import { EngineProductGrid } from '../components/EngineProductGrid';

// Assuming HomePageProps is defined or imported elsewhere,
// for the sake of syntactic correctness, we'll define a placeholder if not explicitly imported.
// If HomePageProps is meant to be imported, please provide the import path.
interface HomePageProps { }

export const OgabasseyHomePage: React.FC<HomePageProps> = () => {
  const merchantContext = useMerchantSafe();
  const storeSlug = merchantContext?.merchant?.slug;

  return (
    <>
      <Hero />

      {/* Horizontal Carousel Banner */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 md:py-6">
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
