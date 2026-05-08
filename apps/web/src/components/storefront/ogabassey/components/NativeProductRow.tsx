'use client';

import type React from 'react';
import { NativeProductAd, NativeProductAdStatic, type NativeAdData } from './NativeProductAd';

interface NativeProductRowProps {
    /** Optional class name for the row container */
    className?: string;
    /** Number of ads to display (default: 4) */
    count?: number;
    /** Unique prefix for ad slot IDs */
    slotPrefix?: string;
    /** Store slug for routing */
    storeSlug?: string;
    /** Test mode - use static data instead of real ads */
    testMode?: boolean;
}

// Sample test ads for development/preview
const TEST_ADS: NativeAdData[] = [
    {
        headline: 'Sony WH-1000XM5 Headphones',
        image: 'https://cdn.ogabassey.com/products/sony-wh-1000xm5.avif',
        body: 'Industry-leading noise cancellation',
        price: '₦185,000',
        cta: 'Shop Now',
        clickUrl: 'https://example.com/sony-headphones',
        starRating: 5,
        advertiserName: 'Sony Nigeria',
    },
    {
        headline: 'Apple Watch Ultra 2',
        image: 'https://cdn.ogabassey.com/products/apple-watch-ultra.avif',
        body: 'The most rugged Apple Watch ever',
        price: '₦850,000',
        cta: 'Learn More',
        clickUrl: 'https://example.com/apple-watch',
        starRating: 5,
        advertiserName: 'Apple',
    },
    {
        headline: 'Anker PowerHouse 767',
        image: 'https://cdn.ogabassey.com/products/anker-powerhouse.avif',
        body: 'Portable power station for home backup',
        price: '₦520,000',
        cta: 'Buy Now',
        clickUrl: 'https://example.com/anker-power',
        starRating: 4,
        advertiserName: 'Anker',
    },
    {
        headline: 'Samsung Odyssey G9',
        image: 'https://cdn.ogabassey.com/products/samsung-odyssey.avif',
        body: '49" Curved Gaming Monitor, 240Hz',
        price: '₦1,290,000',
        cta: 'View Details',
        clickUrl: 'https://example.com/samsung-monitor',
        starRating: 5,
        advertiserName: 'Samsung',
    },
];

/**
 * NativeProductRow - Renders 4 native ads styled as product cards
 * 
 * These ads use the actual ProductGridItem component, so they
 * look exactly like real products with a "Sponsored" badge.
 * 
 * Usage:
 * ```tsx
 * // Test mode with sample data
 * <NativeProductRow testMode />
 * 
 * // Production with real GAM ads
 * <NativeProductRow slotPrefix="home-row-1" storeSlug={basePath} />
 * ```
 */
export const NativeProductRow: React.FC<NativeProductRowProps> = ({
    className = '',
    count = 4,
    slotPrefix = 'native-product',
    storeSlug,
    testMode = false,
}) => {
    // Generate unique slot IDs for each ad position
    const slotIds = Array.from({ length: count }, (_, i) => `${slotPrefix}-${i + 1}`);

    return (
        <div className={`col-span-full my-4 ${className}`}>
            {/* Row Header */}
            <div className="flex items-center gap-2 mb-4 px-1">
                <div className="h-px flex-1 bg-linear-to-r from-gray-200 to-transparent" />
                <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest px-2">
                    Sponsored Products
                </span>
                <div className="h-px flex-1 bg-linear-to-l from-gray-200 to-transparent" />
            </div>

            {/* Ads Grid - 4 columns on desktop, 2 on mobile (matches product grid) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                {testMode
                    ? // Test mode: Use static components with sample data
                    TEST_ADS.slice(0, count).map((ad, index) => (
                        <NativeProductAdStatic
                            key={`test-ad-${index}`}
                            ad={ad}
                            storeSlug={storeSlug}
                        />
                    ))
                    : // Production mode: Use actual GAM native ads
                    slotIds.map((slotId) => (
                        <NativeProductAd
                            key={slotId}
                            slotId={slotId}
                            storeSlug={storeSlug}
                        />
                    ))}
            </div>

            {/* Row Footer */}
            <div className="flex items-center gap-2 mt-4 px-1">
                <div className="h-px flex-1 bg-linear-to-r from-transparent to-gray-200" />
                <span className="text-gray-300 text-[9px] font-medium uppercase tracking-wide px-2">
                    Ad
                </span>
                <div className="h-px flex-1 bg-linear-to-l from-transparent to-gray-200" />
            </div>
        </div>
    );
};


