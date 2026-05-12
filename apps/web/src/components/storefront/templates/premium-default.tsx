'use client';

import { Footer } from '@/components/storefront/blocks/footer';
import { Header } from '@/components/storefront/blocks/header';
import { HeroCarousel } from '@/components/storefront/blocks/hero-carousel';
import { NewsletterSection } from '@/components/storefront/blocks/newsletter-section';
import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import { useMerchant } from '@/hooks/use-merchant-client';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { TemplatePageProps } from '@/templates/registry';

export function PremiumDefaultTemplate({ isPreview }: TemplatePageProps) {
  const { merchant } = useMerchant();

  // Default slides if no merchant data or specific config
  const heroSlides = [
    {
      image:
        PlaceHolderImages.find((img) => img.id === 'hero-fashion-1')
          ?.imageUrl || '/placeholder.png',
      title: 'Elevate Your Style',
      subtitle:
        'Discover the latest trends in sustainable fashion. Curated just for you.',
      ctaText: 'Shop Collection',
      ctaLink: '#products',
    },
    {
      image:
        PlaceHolderImages.find((img) => img.id === 'hero-minimal-1')
          ?.imageUrl || '/placeholder.png',
      title: 'Summer Essentials',
      subtitle: 'Lightweight, breathable, and stylish. Perfect for the season.',
      ctaText: 'View Lookbook',
      ctaLink: '#products',
    },
    {
      image:
        PlaceHolderImages.find((img) => img.id === 'hero-tech-1')?.imageUrl ||
        '/placeholder.png',
      title: 'New Arrivals',
      subtitle: 'Be the first to wear our exclusive new drops.',
      ctaText: 'Shop New In',
      ctaLink: '#products',
    },
  ];

  // Navigation links
  const navLinks = [
    { label: 'Home', url: '/' },
    { label: 'Shop', url: '#products' },
    { label: 'Collections', url: '#' },
    { label: 'About', url: '#' },
    { label: 'Contact', url: '#' },
  ];

  // Footer links
  const quickLinks = [
    { label: 'New Arrivals', url: '#' },
    { label: 'Best Sellers', url: '#' },
    { label: 'Accessories', url: '#' },
    { label: 'Sale', url: '#' },
  ];

  const socialLinks = {
    facebook: 'https://facebook.com',
    instagram: 'https://instagram.com',
    twitter: 'https://twitter.com',
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans selection:bg-black selection:text-white">
      {/* 1. Header Block */}
      <Header
        isPreview={isPreview}
        showLogo={true}
        showSearch={true}
        showCart={true}
        showMenu={true}
        navigationLinks={navLinks}
        layout="logo-left-nav-center"
        glassEffect={true}
        sticky={true}
        searchStyle="outline"
        searchRadius="full"
      />

      <main>
        {/* 2. Hero Carousel Block */}
        <HeroCarousel
          slides={heroSlides}
          autoplayDelay={6000}
          height="fullscreen"
        />

        {/* 3. Product Grid Block */}
        <div className="bg-white">
          <StorefrontProductGrid
            title="Curated Collection"
            columns={4}
            limit={8}
            showFilters={true}
          />
        </div>

        {/* 4. Newsletter Section Block */}
        <NewsletterSection
          title="Join the Inner Circle"
          description="Get early access to new drops, exclusive discounts, and styling tips delivered straight to your inbox."
          backgroundColor="#111111"
        />
      </main>

      {/* 5. Footer Block */}
      <Footer
        businessName={merchant?.business_name || 'Store'}
        showQuickLinks={true}
        quickLinks={quickLinks}
        socialLinks={socialLinks}
        showNewsletter={false} // Using separate section above
        backgroundColor="#000000"
        textColor="#FFFFFF"
      />
    </div>
  );
}
