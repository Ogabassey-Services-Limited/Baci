import type React from 'react';
import type { Product } from '../types'; // Use local type for consistency with InteractiveProductGrid
import { BannerCarousel } from '../components/BannerCarousel';
import { Hero } from '../components/Hero';
import { InteractiveProductGrid } from '../components/InteractiveProductGrid';

interface HomePageProps {
  products: Product[];
}

export const HomePage: React.FC<HomePageProps> = ({ products = [] }) => {
  return (
    <>
      <Hero />

      {/* Horizontal Carousel Banner */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 mb-6">
        <BannerCarousel className="h-40 md:h-52" />
      </div>

      <InteractiveProductGrid products={products} />
    </>
  );
};
