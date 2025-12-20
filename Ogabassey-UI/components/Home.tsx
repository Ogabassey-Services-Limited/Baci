import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hero } from './Hero';
import { InteractiveProductGrid } from './InteractiveProductGrid';
import { BannerCarousel } from './BannerCarousel';

export const Home: React.FC = () => {
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