'use client';

import { useMerchant } from '@/hooks/use-merchant';
import { OgabasseyHeader } from '@/components/storefront/blocks/ogabassey-header';
import { Footer } from '@/components/storefront/blocks/footer';
import { BentoGridHero } from '@/components/storefront/blocks/bento-grid-hero';
import { CategoryIcons } from '@/components/storefront/blocks/category-icons';
import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import { Phone, Wifi, Laptop, Speaker, Gamepad2 } from 'lucide-react';

export function GadgetCustomTemplateOgabassey() {
    const { merchant } = useMerchant();

    // Hardcoded data for Ogabassey demo
    const bentoImages = [
        {
            src: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=1000&auto=format&fit=crop', // iPhone 15/16 Red
            alt: 'iPhone 16 Pro Max',
            title: 'iPhone 16 Pro Max',
            subtitle: 'Maximize your CREATIVITY',
            textColor: 'text-white',
            ctaLink: '#iphone'
        },
        {
            src: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca4?q=80&w=1000&auto=format&fit=crop', // MacBook
            alt: 'MacBook Pro',
            title: 'MacBook Pro',
            subtitle: 'Elevate your workflow',
            textColor: 'text-white',
            ctaLink: '#macbook'
        },
        {
            src: 'https://images.unsplash.com/photo-1606318801954-d46d46d3360a?q=80&w=1000&auto=format&fit=crop', // PS5 Controller
            alt: 'PS5 Pro',
            title: 'PS5 Pro Edition',
            subtitle: 'Elevate your game',
            textColor: 'text-white',
            ctaLink: '#ps5'
        }
    ];

    const categories = [
        { label: 'Phones', icon: 'smartphone', link: '#phones' },
        { label: 'Gaming', icon: 'gaming', link: '#gaming' },
        { label: 'Accessories', icon: 'headphones', link: '#accessories' },
        { label: 'Printers', icon: 'printer', link: '#printers' },
        { label: 'Laptop', icon: 'laptop', link: '#laptops' },
    ];

    // Service highlights (using same component style for now)
    const services = [
        { label: 'We Pay YOU When', icon: 'smartphone', link: '#', color: 'bg-red-100' }, // Placeholder icon
        { label: 'You Buy Airtime!', icon: 'wifi', link: '#', color: 'bg-red-100' },
    ];

    return (
        <div className="min-h-screen bg-white font-sans">
            {/* 1. Header with Phone Art Background */}
            <OgabasseyHeader
                logoText="Ogabassey"
                showSearch={true}
                showCart={true}
                showUser={true}
                showBell={true}
            />

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
                            <span className="font-bold text-lg">We Pay YOU When</span>
                        </div>

                        <div className="flex gap-8">
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
                            <span className="font-bold text-lg">You Buy <span className="text-red-500">Airtime!</span></span>
                        </div>
                    </div>
                </div>
            </main>

            {/* 6. Footer */}
            <Footer
                businessName="Ogabassey"
                backgroundColor="#000000"
                textColor="#FFFFFF"
                showNewsletter={true}
            />
        </div>
    );
}
