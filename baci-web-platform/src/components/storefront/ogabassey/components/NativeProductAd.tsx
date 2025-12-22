'use client';

import { Star } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

/**
 * Native ad data structure from Google Ad Manager
 */
export interface NativeAdData {
    headline: string;
    image: string;
    body?: string;
    price?: string;
    cta: string;
    clickUrl: string;
    advertiserName?: string;
    advertiserLogo?: string;
    starRating?: number;
}

interface NativeProductAdProps {
    /** Unique slot ID for this ad position */
    slotId: string;
    /** Optional class name for styling */
    className?: string;
}

// Placeholder image for ads without images
const PLACEHOLDER_IMAGE =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect fill="%23f3f4f6" width="400" height="400"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="32" fill="%239ca3af"%3ESponsored%3C/text%3E%3C/svg%3E';

// Network code from existing AdUnit
const NETWORK_CODE = '/23331099951';

/**
 * NativeProductAd - Renders a native ad that looks like a product card
 * 
 * This component matches the styling of ProductGridItem but displays
 * advertiser content with a "Sponsored" badge for compliance.
 */
export const NativeProductAd: React.FC<NativeProductAdProps> = ({
    slotId,
    className = '',
}) => {
    const adRef = useRef<HTMLDivElement>(null);
    const [adData, setAdData] = useState<NativeAdData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // Ensure googletag is available
        window.googletag = window.googletag || { cmd: [] };

        window.googletag.cmd.push(() => {
            const slotPath = `${NETWORK_CODE}/native_product_card`;

            // Define native ad slot - use a standard size, GAM handles responsiveness
            const slot = window.googletag.defineSlot(slotPath, [300, 400], slotId);

            if (slot) {
                slot.addService(window.googletag.pubads());

                // Listen for native ad data
                // biome-ignore lint/suspicious/noExplicitAny: External GPT library event type
                window.googletag.pubads().addEventListener('slotRenderEnded', (event: any) => {
                    if (event.slot === slot) {
                        if (event.isEmpty) {
                            setHasError(true);
                            setIsLoading(false);
                        }
                    }
                });

                // For native ads, we need to use the native template
                // The ad data will be rendered by GAM into our container
                window.googletag.display(slotId);
                setIsLoading(false);
            } else {
                setHasError(true);
                setIsLoading(false);
            }
        });

        return () => {
            // Cleanup handled by GAM
        };
    }, [slotId]);

    // If no ad or error, render a minimal placeholder that doesn't disrupt layout
    if (hasError) {
        return null;
    }

    // Loading skeleton matching ProductGridItem
    if (isLoading) {
        return (
            <div className={`bg-white border border-gray-100 rounded-2xl p-3 md:p-4 shadow-sm flex flex-col h-full ${className}`}>
                <div className="relative aspect-square mb-3 md:mb-4 bg-gray-100 rounded-2xl animate-pulse" />
                <div className="flex flex-col flex-1 px-1 pt-1">
                    <div className="h-3 bg-gray-100 rounded w-20 mb-2 animate-pulse" />
                    <div className="h-5 bg-gray-100 rounded w-full mb-1 animate-pulse" />
                    <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
                </div>
            </div>
        );
    }

    // The actual native ad container - GAM will inject content here
    // We wrap it in a styled container that matches ProductGridItem
    return (
        <div
            className={`bg-white border border-gray-100 rounded-2xl p-3 md:p-4 shadow-sm md:hover:shadow-xl transition-all duration-300 group flex flex-col h-full relative ${className}`}
        >
            {/* Sponsored Badge - Required by Google Policy */}
            <div className="absolute top-3 left-3 z-20 bg-gray-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide backdrop-blur-sm">
                Sponsored
            </div>

            {/* Native ad container - GAM renders content here */}
            <div
                id={slotId}
                ref={adRef}
                className="native-product-ad w-full h-full"
                style={{ minHeight: '280px' }}
            />
        </div>
    );
};

/**
 * NativeProductAdFallback - Static version for testing/fallback
 * Uses provided data instead of fetching from GAM
 */
export const NativeProductAdFallback: React.FC<{
    ad: NativeAdData;
    className?: string;
}> = ({ ad, className = '' }) => {
    const [isImageLoaded, setIsImageLoaded] = useState(false);

    return (
        <a
            href={ad.clickUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={`bg-white border border-gray-100 rounded-2xl p-3 md:p-4 shadow-sm md:hover:shadow-xl active:shadow-md active:scale-[0.99] transition-all duration-300 group flex flex-col h-full relative block ${className}`}
        >
            {/* Sponsored Badge - Required by Google Policy */}
            <div className="absolute top-5 left-5 z-20 bg-gray-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide backdrop-blur-sm">
                Sponsored
            </div>

            {/* Image Container */}
            <div className="relative aspect-square mb-3 md:mb-4 bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden">
                {/* Skeleton Loader */}
                {!isImageLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2/3 h-2/3 bg-gray-200 rounded-lg animate-pulse" />
                    </div>
                )}

                <img
                    src={ad.image || PLACEHOLDER_IMAGE}
                    alt={ad.headline}
                    loading="lazy"
                    onLoad={() => setIsImageLoaded(true)}
                    onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER_IMAGE;
                        setIsImageLoaded(true);
                    }}
                    className={`w-full h-full object-contain p-4 transition-all duration-500 ${isImageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                        }`}
                />

                {/* Advertiser Logo - Bottom Right */}
                {ad.advertiserLogo && (
                    <img
                        src={ad.advertiserLogo}
                        alt={ad.advertiserName || 'Advertiser'}
                        className="absolute bottom-2 right-2 w-8 h-8 rounded-full border-2 border-white shadow-sm object-cover"
                    />
                )}
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 px-1 pt-1">
                {/* Star Rating (if available) */}
                {ad.starRating && ad.starRating > 0 && (
                    <div className="flex items-center mb-1.5">
                        <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                                <Star
                                    key={i}
                                    size={12}
                                    className={`${i < Math.floor(ad.starRating || 0)
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-gray-300'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Headline (Product Name) */}
                <h3 className="font-bold text-base text-gray-900 mb-1 leading-tight line-clamp-2 md:group-hover:text-red-600 transition-colors">
                    {ad.headline}
                </h3>

                {/* Body (Description) */}
                {ad.body && (
                    <p className="text-gray-400 text-[11px] mb-2 line-clamp-1 hidden md:block">
                        {ad.body}
                    </p>
                )}

                {/* Price & CTA */}
                <div className="mt-auto flex items-end justify-between border-t border-dashed border-gray-100 pt-3">
                    {ad.price && (
                        <span className="text-red-600 font-extrabold text-lg tracking-tight">
                            {ad.price}
                        </span>
                    )}
                    <span className="text-xs font-semibold text-gray-900 md:hover:text-red-600 cursor-pointer">
                        {ad.cta || 'Learn More'} →
                    </span>
                </div>
            </div>
        </a>
    );
};
