'use client';

import { Gamepad2, Laptop, Phone, Speaker, Wifi } from 'lucide-react';
import { BentoGridHero } from '@/components/storefront/blocks/bento-grid-hero';
import { CategoryIcons } from '@/components/storefront/blocks/category-icons';
import { Footer } from '@/components/storefront/blocks/footer';
import { StorefrontHeader } from '@/components/storefront/header';
import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import { useMerchant } from '@/hooks/use-merchant-client';

export function GadgetUniverseTemplate() {
  const { merchant, basePath } = useMerchant();

  const getFullHref = (path: string) => {
    return `${basePath || ''}${path === '/' ? '' : path}`;
  };

  // Dynamic hero images based on merchant suggestion or defaults
  const bentoImages = [
    {
      src: 'https://images.unsplash.com/photo-1616348436168-de43ad0db179?q=80&w=2000&auto=format&fit=crop', // iPhone
      alt: 'Latest Smartphone',
      title: 'Latest Smartphone',
      subtitle: 'Maximize your CREATIVITY',
      textColor: 'text-white',
      ctaLink: getFullHref('/category/phones'),
    },
    {
      src: 'https://images.unsplash.com/photo-1517336713481-43923eeadfe4?q=80&w=2000&auto=format&fit=crop', // MacBook
      alt: 'Pro Laptop',
      title: 'Pro Laptop',
      subtitle: 'Elevate your workflow',
      textColor: 'text-white',
      ctaLink: getFullHref('/category/laptops'),
    },
    {
      src: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?q=80&w=2000&auto=format&fit=crop', // PS5
      alt: 'Gaming Console',
      title: 'Next-Gen Gaming',
      subtitle: 'Elevate your game',
      textColor: 'text-white',
      ctaLink: getFullHref('/category/gaming'),
    },
  ];

  const categories = [
    {
      label: 'Phones',
      icon: 'smartphone',
      link: getFullHref('/category/phones'),
    },
    { label: 'Gaming', icon: 'gaming', link: getFullHref('/category/gaming') },
    {
      label: 'Accessories',
      icon: 'headphones',
      link: getFullHref('/category/accessories'),
    },
    {
      label: 'Printers',
      icon: 'printer',
      link: getFullHref('/category/printers'),
    },
    { label: 'Laptop', icon: 'laptop', link: getFullHref('/category/laptops') },
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* 1. Header */}
      <StorefrontHeader />

      <main>
        {/* 2. Bento Grid Hero */}
        <BentoGridHero images={bentoImages} height="medium" />

        {/* 3. Category Icons */}
        <CategoryIcons categories={categories} />

        {/* 4. Product Grid */}
        <div className="bg-neutral-50 py-12">
          <StorefrontProductGrid
            title="Featured Products"
            columns={4}
            limit={8}
            showFilters={true}
          />
        </div>

        {/* 5. Service Highlights (Bottom) */}
        <div className="container mx-auto px-4 py-8 border-t">
          <div className="flex justify-between items-center bg-pink-50 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-full text-red-600">
                <Phone className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg">Trade-in Available</span>
            </div>

            <div className="flex gap-8 hidden md:flex">
              <div className="flex flex-col items-center gap-2 text-red-500">
                <Wifi className="w-6 h-6" />
              </div>
              <div className="flex flex-col items-center gap-2 text-red-500">
                <Laptop className="w-6 h-6" />
              </div>
              <div className="flex flex-col items-center gap-2 text-red-500">
                <Speaker className="w-6 h-6" />
              </div>
              <div className="flex flex-col items-center gap-2 text-red-500">
                <Gamepad2 className="w-6 h-6" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">
                Upgrade <span className="text-red-500">Today!</span>
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* 6. Footer */}
      <Footer
        businessName={merchant?.business_name || 'Gadget Universe'}
        backgroundColor="#000000"
        textColor="#FFFFFF"
        showNewsletter={true}
      />
    </div>
  );
}
