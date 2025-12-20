'use client';

import { Gamepad2, Laptop, Phone, Speaker, Wifi } from 'lucide-react';
import { BentoGridHero } from '@/components/storefront/blocks/bento-grid-hero';
import { CategoryIcons } from '@/components/storefront/blocks/category-icons';
import { Footer } from '@/components/storefront/blocks/footer';
import { StorefrontHeader } from '@/components/storefront/header';
import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import { useMerchant } from '@/hooks/use-merchant';

export function GadgetUniverseTemplate() {
  const { merchant } = useMerchant();

  // Dynamic hero images based on merchant suggestion or defaults
  const bentoImages = [
    {
      src: '/placeholder.png', // iPhone 15/16 Red
      alt: 'Latest Smartphone',
      title: 'Latest Smartphone',
      subtitle: 'Maximize your CREATIVITY',
      textColor: 'text-white',
      ctaLink: '#iphone',
    },
    {
      src: '/placeholder.png', // MacBook
      alt: 'Pro Laptop',
      title: 'Pro Laptop',
      subtitle: 'Elevate your workflow',
      textColor: 'text-white',
      ctaLink: '#macbook',
    },
    {
      src: '/placeholder.png', // PS5 Controller
      alt: 'Gaming Console',
      title: 'Next-Gen Gaming',
      subtitle: 'Elevate your game',
      textColor: 'text-white',
      ctaLink: '#ps5',
    },
  ];

  const categories = [
    { label: 'Phones', icon: 'smartphone', link: '#phones' },
    { label: 'Gaming', icon: 'gaming', link: '#gaming' },
    { label: 'Accessories', icon: 'headphones', link: '#accessories' },
    { label: 'Printers', icon: 'printer', link: '#printers' },
    { label: 'Laptop', icon: 'laptop', link: '#laptops' },
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
