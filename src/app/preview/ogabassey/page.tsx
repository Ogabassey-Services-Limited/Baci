'use client';

import { BannerCarousel } from '@/components/storefront/ogabassey/components/BannerCarousel';
import { BlogSnippet } from '@/components/storefront/ogabassey/components/BlogSnippet';
import { EngineProductGrid } from '@/components/storefront/ogabassey/components/EngineProductGrid';
import { Hero } from '@/components/storefront/ogabassey/components/Hero';
import { OgabasseyFooter } from '@/components/storefront/ogabassey/layout/footer';
import { MobileFooter as OgabasseyMobileFooter } from '@/components/storefront/ogabassey/layout/mobile-footer';
import { OgabasseyNavbar } from '@/components/storefront/ogabassey/layout/navbar';
import { CartProvider } from '@/hooks/use-cart';
import { V2SavedProvider } from '@/components/storefront/ogabassey/providers/v2-saved-context';

export default function OgabasseyPreviewPage() {
  return (
    <CartProvider enableSmartCartPro={true}>
      <V2SavedProvider>
        <div className="min-h-screen bg-white">
          {/* Ogabassey Navbar */}
          <OgabasseyNavbar
            storeName="Ogabassey"
            storeSlug="ogabassey"
            showSearch={true}
            showCart={true}
            showUser={true}
            showBell={true}
          />

          {/* Hero Section - Apple-style carousel with product promos */}
          <Hero />

          {/* Banner Carousel - Promotional banners */}
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 md:py-6">
            <BannerCarousel className="h-40 md:h-52" />
          </div>

          {/* Engine Featured Products Grid */}
          <EngineProductGrid
            title="Featured Products"
            showViewAll={true}
            useMockData={true}
          />

          {/* Blog Snippet - Tech article preview */}
          <div className="max-w-[1400px] mx-auto px-4 md:px-6">
            <BlogSnippet category="Phones" />
          </div>

          {/* Ogabassey Footer */}
          <OgabasseyFooter storeSlug="ogabassey" />

          {/* Ogabassey Mobile Footer */}
          <OgabasseyMobileFooter />
        </div>
      </V2SavedProvider>
    </CartProvider>
  );
}
