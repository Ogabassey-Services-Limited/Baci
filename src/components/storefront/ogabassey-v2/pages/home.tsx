// @ts-nocheck - Template preview
import React from 'react';
import { Hero } from '../components/Hero';
import { InteractiveProductGrid } from '../components/InteractiveProductGrid';
import { BannerCarousel } from '../components/BannerCarousel';

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
