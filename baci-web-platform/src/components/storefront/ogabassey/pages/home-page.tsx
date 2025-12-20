import type React from 'react';
import type { Product } from '@/components/storefront/ogabassey/types';
import { BannerCarousel } from '@/components/storefront/ogabassey/components/BannerCarousel';
import { Hero } from '@/components/storefront/ogabassey/components/Hero';
import { InteractiveProductGrid } from '@/components/storefront/ogabassey/components/InteractiveProductGrid';

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
