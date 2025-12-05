'use client';

import type React from 'react';
import { BannerCarousel } from './banner-carousel';
import { Hero } from './hero';
import { InteractiveProductGrid } from './interactive-product-grid';
import { Navbar } from './navbar';
import { SavedProvider } from './saved-context';

export const Home: React.FC = () => {
  return (
    <SavedProvider>
      <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-red-100 selection:text-red-900">
        <Navbar />
        <main>
          <Hero />
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 mb-8">
            <BannerCarousel />
          </div>
          <InteractiveProductGrid />
        </main>
      </div>
    </SavedProvider>
  );
};
