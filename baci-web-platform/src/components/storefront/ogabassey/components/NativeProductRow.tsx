'use client';

import type React from 'react';
import { NativeProductAd, NativeProductAdFallback, type NativeAdData } from './NativeProductAd';

interface NativeProductRowProps {
    /** Optional class name for the row container */
    className?: string;
    /** Number of ads to display (default: 4) */
    count?: number;
    /** Unique prefix for ad slot IDs */
    slotPrefix?: string;
    /** Test mode - use fallback data instead of real ads */
    testMode?: boolean;
}

// Sample test ads for development/preview
const TEST_ADS: NativeAdData[] = [
    {
        headline: 'Premium Wireless Headphones',
        image: 'https://cdn.ogabassey.com/products/sony-wh-1000xm5.avif',
        body: 'Industry-leading noise cancellation',
        price: '₦185,000',
        cta: 'Shop Now',
        clickUrl: '#',
        starRating: 5,
        advertiserName: 'Sony',
    },
    {
        headline: 'Smart Fitness Watch',
        image: 'https://cdn.ogabassey.com/products/apple-watch-ultra.avif',
        body: 'Track your health 24/7',
        price: '₦450,000',
        cta: 'Learn More',
        clickUrl: '#',
        starRating: 4,
        advertiserName: 'Apple',
    },
    {
        headline: 'Portable Power Station',
        image: 'https://cdn.ogabassey.com/products/anker-powerhouse.avif',
        body: 'Never run out of power',
        price: '₦320,000',
        cta: 'Buy Now',
        clickUrl: '#',
        starRating: 5,
        advertiserName: 'Anker',
    },
    {
        headline: '4K Gaming Monitor',
        image: 'https://cdn.ogabassey.com/products/samsung-odyssey.avif',
        body: '144Hz refresh rate, 1ms response',
        price: '₦890,000',
        cta: 'View Details',
        clickUrl: '#',
        starRating: 5,
        advertiserName: 'Samsung',
    },
];

/**
 * NativeProductRow - Renders 4 native ads in a horizontal row
 * 
 * This component displays native ads styled to look like product cards,
 * seamlessly integrating into the product grid.
 * 
 * Usage:
 * <NativeProductRow slotPrefix="home-row-1" />
 * 
 * In test mode:
 * <NativeProductRow testMode />
 */
export const NativeProductRow: React.FC<NativeProductRowProps> = ({
    className = '',
    count = 4,
    slotPrefix = 'native-product',
    testMode = false,
}) => {
    // Generate slot IDs for each ad position
    const slotIds = Array.from({ length: count }, (_, i) => `${slotPrefix}-${i + 1}`);

    return (
        <div className={`col-span-full ${className}`}>
            {/* Row Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wider">
                        Sponsored Products
                    </span>
                </div>
            </div>

            {/* Ads Grid - 4 columns on desktop, 2 on mobile */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                {testMode
                    ? // Test mode: Use fallback components with sample data
                    TEST_ADS.slice(0, count).map((ad, index) => (
                        <NativeProductAdFallback key={index} ad={ad} />
                    ))
                    : // Production mode: Use actual GAM native ads
                    slotIds.map((slotId) => (
                        <NativeProductAd key={slotId} slotId={slotId} />
                    ))}
            </div>
        </div>
    );
};

export default NativeProductRow;
