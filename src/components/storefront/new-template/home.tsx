'use client';

import React from 'react';
import { Navbar } from './navbar';
import { Hero } from './hero';
import { BannerCarousel } from './banner-carousel';
import { InteractiveProductGrid } from './interactive-product-grid';
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
