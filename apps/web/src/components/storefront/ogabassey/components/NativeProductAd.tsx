'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ProductGridItem } from './ProductGridItem';
import type { Product } from '../types';

/**
 * Native ad data structure returned by GAM
 * These fields match the custom native format in GAM
 */
export interface NativeAdData {
    headline: string;
    image: string;
    body?: string;
    price?: string;
    cta?: string;
    clickUrl: string;
    advertiserName?: string;
    advertiserLogo?: string;
    starRating?: number;
}

interface NativeProductAdProps {
    /** Unique slot ID for this ad position */
    slotId: string;
    /** Store slug for routing */
    storeSlug?: string;
    /** Optional class name for styling */
    className?: string;
}

// Network code from existing AdUnit
const _NETWORK_CODE = '/23331099951';

// Track defined slots globally to prevent duplicates
const definedNativeSlots = new Set<string>();

/**
 * Converts native ad data to a Product object for ProductGridItem
 */
function nativeAdToProduct(ad: NativeAdData, index: number): Product {
    // Parse price string (remove currency symbol and commas)
    const priceMatch = ad.price?.match(/[\d,]+/);
    const rawPrice = priceMatch
        ? Number.parseInt(priceMatch[0].replace(/,/g, ''), 10)
        : 0;

    return {
        id: `native-ad-${index}-${Date.now()}`,
        slug: undefined, // No slug - link goes to advertiser
        name: ad.headline,
        price: ad.price || 'Sponsored',
        rawPrice,
        image: ad.image,
        description: ad.body || '',
        rating: ad.starRating || 4.5,
        condition: 'New' as const,
        brand: ad.advertiserName,
        // Mark as sponsored for click handling
        _isSponsored: true,
        _clickUrl: ad.clickUrl,
    } as Product & { _isSponsored: boolean; _clickUrl: string };
}

/**
 * NativeProductAd - Fetches native ad from GAM and renders using ProductGridItem
 * 
 * This gives pixel-perfect matching with real products while showing
 * a "Sponsored" badge overlay for compliance.
 */
export const NativeProductAd: React.FC<NativeProductAdProps> = ({
    slotId,
    storeSlug,
    className = '',
}) => {
    const basePath = storeSlug
        ? (storeSlug.startsWith('/') ? storeSlug : `/${storeSlug}`)
        : '';
    const containerRef = useRef<HTMLDivElement>(null);
    const slotRef = useRef<googletag.Slot | null>(null);
    const [adData, setAdData] = useState<NativeAdData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        if (definedNativeSlots.has(slotId)) return;

        window.googletag = window.googletag || { cmd: [] };

        window.googletag.cmd.push(() => {
            if (definedNativeSlots.has(slotId)) return;

            // Define slot for Native format
            // @ts-ignore - 'fluid' size type definition mismatch in strict mode
            const slot = window.googletag.defineSlot('/23331099951/native_product_card', ['fluid'], slotId);

            if (slot) {
                definedNativeSlots.add(slotId);
                slotRef.current = slot;
                slot.addService(window.googletag.pubads());

                // CRITICAL: Listen for native ad load event to get the DATA, not the HTML
                // biome-ignore lint/suspicious/noExplicitAny: GPT event type
                window.googletag.pubads().addEventListener('slotNativeAdLoad', (event: any) => {
                    if (event.slot === slot) {
                        const nativeAd = event.nativeAd;
                        // Map GPT Native Ad fields to our structure
                        // Note: Keys depend on your specific GAM Native Ad configuration (vars)
                        setAdData({
                            headline: nativeAd.get('headline') || nativeAd.get('name') || 'Sponsored Product',
                            image: nativeAd.get('image')?.url || nativeAd.get('main_image')?.url || '',
                            body: nativeAd.get('body') || nativeAd.get('description'),
                            price: nativeAd.get('price'),
                            cta: nativeAd.get('cta') || 'View',
                            clickUrl: nativeAd.get('clickUrl') || '#',
                            advertiserName: nativeAd.get('advertiser'),
                            starRating: Number(nativeAd.get('rating')) || 5,
                        });
                        setIsLoading(false);
                    }
                });

                // Handle render failure
                // biome-ignore lint/suspicious/noExplicitAny: GPT event type
                window.googletag.pubads().addEventListener('slotRenderEnded', (event: any) => {
                    if (event.slot === slot && event.isEmpty) {
                        setHasError(true);
                        setIsLoading(false);
                    }
                });

                window.googletag.enableServices();
                window.googletag.display(slotId);
            } else {
                setHasError(true);
                setIsLoading(false);
            }
        });

        return () => {
            if (slotRef.current) {
                window.googletag?.cmd.push(() => {
                    window.googletag.destroySlots([slotRef.current!]);
                    definedNativeSlots.delete(slotId);
                });
            }
        };
    }, [slotId]);

    if (hasError) return null;

    if (isLoading || !adData) {
        return (
            <div className={`relative ${className}`}>
                <div className="bg-white border border-gray-100 rounded-2xl p-3 md:p-4 shadow-sm flex flex-col h-full">
                    <div className="relative aspect-square mb-3 md:mb-4 bg-gray-100 rounded-2xl animate-pulse" />
                    <div className="flex flex-col flex-1 px-1 pt-1">
                        <div className="h-3 bg-gray-100 rounded w-20 mb-2 animate-pulse" />
                        <div className="h-5 bg-gray-100 rounded w-full mb-1 animate-pulse" />
                        <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
                    </div>
                </div>
                {/* GPT Slot Container - must be present but hidden for data-only mode */}
                <div id={slotId} ref={containerRef} className="hidden" />
            </div>
        );
    }

    const adProduct = nativeAdToProduct(adData, 0);

    const handleSponsoredClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Use GPT's built-in click tracker if available, or just open URL
        window.open(adData.clickUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className={`relative group ${className}`}>
            <div className="absolute top-5 left-5 z-30 bg-gray-900/90 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-xs shadow-lg">
                Sponsored
            </div>
            <a
                href={adData.clickUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="absolute inset-0 z-20"
                onClick={handleSponsoredClick}
                aria-label={`Sponsored: ${adProduct.name}`}
            >
                <span className="sr-only">Sponsored: {adProduct.name}</span>
            </a>
            <div className="pointer-events-none">
                <ProductGridItem
                    product={adProduct}
                    onAddToCart={(e) => { e.preventDefault(); }}
                    isAdded={false}
                    cartQuantity={0}
                    viewMode="grid"
                    isWishlisted={false}
                    onToggleWishlist={(e) => { e.preventDefault(); }}
                    basePath={basePath}
                />
            </div>
            {/* The slot div is still required for GPT to initialize, even if we render custom UI */}
            <div id={slotId} className="hidden" />
        </div>
    );
};

/**
 * NativeProductAdStatic - For testing/preview without GAM
 * Renders a mock sponsored product using ProductGridItem
 */
export const NativeProductAdStatic: React.FC<{
    ad: NativeAdData;
    storeSlug?: string;
    className?: string;
}> = ({ ad, storeSlug, className = '' }) => {
    const basePath = storeSlug
        ? (storeSlug.startsWith('/') ? storeSlug : `/${storeSlug}`)
        : '';
    const adProduct = nativeAdToProduct(ad, 0);

    return (
        <div className={`relative group ${className}`}>
            {/* Sponsored Badge Overlay */}
            <div className="absolute top-5 left-5 z-30 bg-gray-900/90 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-xs shadow-lg">
                Sponsored
            </div>

            {/* Advertiser click overlay */}
            <a
                href={ad.clickUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="absolute inset-0 z-20"
                aria-label={`Sponsored: ${adProduct.name}`}
            >
                <span className="sr-only">Sponsored: {adProduct.name}</span>
            </a>

            {/* Render using actual ProductGridItem */}
            <div className="pointer-events-none">
                <ProductGridItem
                    product={adProduct}
                    onAddToCart={(e) => e.preventDefault()}
                    isAdded={false}
                    cartQuantity={0}
                    viewMode="grid"
                    isWishlisted={false}
                    onToggleWishlist={(e) => e.preventDefault()}
                    basePath={basePath}
                />
            </div>
        </div>
    );
};

