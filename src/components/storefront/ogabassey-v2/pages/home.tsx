// @ts-nocheck - Template preview
import type React from 'react';
import { BannerCarousel } from '../components/BannerCarousel';
import { Hero } from '../components/Hero';
import { InteractiveProductGrid } from '../components/InteractiveProductGrid';

export const OgabasseyV2HomePage: React.FC = () => {
  return (
    <>
      <Hero />

      {/* Horizontal Carousel Banner */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 mb-6">
        <BannerCarousel className="h-40 md:h-52" />
      </div>

      <InteractiveProductGrid />
    </>
  );
};
