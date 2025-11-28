'use client';

import { useMerchant } from '@/hooks/use-merchant';
import { OgabasseyHeader } from '@/components/storefront/blocks/ogabassey-header';
import { Footer } from '@/components/storefront/blocks/footer';
import { OgabasseyHero } from '@/components/storefront/blocks/ogabassey-hero';
import { AnnouncementBar } from '@/components/storefront/blocks/announcement-bar';
import { CategoryTabs } from '@/components/storefront/blocks/category-tabs';
import { OgabasseyUnifiedPanel } from '@/components/storefront/blocks/ogabassey-unified-panel';
import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import { Newsletter } from '@/components/storefront/blocks/newsletter';

export function OgabasseyTemplate3() {
    const { merchant } = useMerchant();

    // Mock data for the template
    const heroSlides = [
        {
            image: 'https://images.unsplash.com/photo-1696429175928-793a1cdef1d3?q=80&w=2070&auto=format&fit=crop', // iPhone 15 Pro
            title: 'iPhone 15 Pro Max',
            link: '/category/phones',
        },
        {
            image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?q=80&w=2072&auto=format&fit=crop', // PS5
            title: 'PlayStation 5',
            link: '/category/gaming',
        },
        {
            image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca4?q=80&w=2026&auto=format&fit=crop', // MacBook
            title: 'MacBook Pro',
            link: '/category/laptops',
        },
    ];

    const staticBanner1 = 'https://images.unsplash.com/photo-1616348436168-de43ad0db179?q=80&w=1981&auto=format&fit=crop'; // iPhone detail
    const staticBanner2 = 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?q=80&w=2042&auto=format&fit=crop'; // PC Gaming

    const navLinks = [
        { label: 'Home', url: '/' },
        { label: 'Smart phones', url: '/category/smart-phones' },
        { label: 'Laptops', url: '/category/laptops' },
        { label: 'Accessories', url: '/category/accessories' },
        { label: 'Gaming', url: '/category/gaming' },
        { label: 'About Us', url: '/pages/about' },
        { label: 'Pay In Installments', url: '/pages/installments' },
        { label: 'Sell or Swap Device', url: '/pages/swap' },
    ];

    const categories = [
        { label: 'Airtime', icon: 'phone', link: '/category/airtime' },
        { label: 'Data', icon: 'wifi', link: '/category/data' },
        { label: 'Tv', icon: 'monitor', link: '/category/tv' },
        { label: 'Power', icon: 'zap', link: '/category/power' },
        { label: 'Betting', icon: 'gamepad', link: '/category/betting' },
    ];



    return (
        <div className="min-h-screen bg-white font-sans">
            {/* Announcement Bar */}
            <AnnouncementBar />

            {/* Header with Pattern */}
            <OgabasseyHeader />

            <main>
                {/* Hero Section */}
                <OgabasseyHero
                    slides={heroSlides}
                    staticBanner1={staticBanner1}
                    staticBanner2={staticBanner2}
                />

                {/* Unified Panel */}
                <OgabasseyUnifiedPanel categories={categories} />

                {/* Category Tabs */}
                <CategoryTabs links={navLinks} className="mb-8" />

                {/* Product Sections */}
                <div className="container mx-auto px-4 py-8">
                    <StorefrontProductGrid
                        title="Recommended for you"
                        columns={4}
                        limit={4}
                    />

                    <StorefrontProductGrid
                        title="Best for you"
                        columns={4}
                        limit={4}
                    />
                </div>

                {/* Newsletter */}
                <Newsletter
                    title="Subscribe to our newsletter"
                    subtitle="Get the latest updates on new products and upcoming sales."
                    buttonText="Subscribe"
                    backgroundColor="#f9fafb"
                />
            </main>

            <Footer
                showNewsletter={false}
                backgroundColor="#1a1a1a"
                textColor="#ffffff"
            />
        </div>
    );
}
