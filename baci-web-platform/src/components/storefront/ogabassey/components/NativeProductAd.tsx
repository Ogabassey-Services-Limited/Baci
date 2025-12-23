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
const NETWORK_CODE = '/23331099951';

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
    const containerRef = useRef<HTMLDivElement>(null);
    const slotRef = useRef<googletag.Slot | null>(null);
    const [adData, setAdData] = useState<NativeAdData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // Skip if already defined
        if (definedNativeSlots.has(slotId)) {
            return;
        }

        // Ensure googletag is available
        window.googletag = window.googletag || { cmd: [] };

        window.googletag.cmd.push(() => {
            // Double-check inside queue
            if (definedNativeSlots.has(slotId)) {
                return;
            }

            const slotPath = `${NETWORK_CODE}/native_product_card`;

            // Define the slot with standard size (GAM returns native data)
            const slot = window.googletag.defineSlot(slotPath, [300, 400], slotId);

            if (slot) {
                definedNativeSlots.add(slotId);
                slotRef.current = slot;
                slot.addService(window.googletag.pubads());

                // Listen for slot render to extract native data
                // biome-ignore lint/suspicious/noExplicitAny: External GPT library event type
                window.googletag.pubads().addEventListener('slotRenderEnded', (event: any) => {
                    if (event.slot === slot) {
                        if (event.isEmpty) {
                            setHasError(true);
                            setIsLoading(false);
                        } else {
                            // For native ads, GAM provides the creative data
                            // We extract it from the rendered slot
                            extractNativeData(slotId);
                        }
                    }
                });

                window.googletag.display(slotId);
            } else {
                setHasError(true);
                setIsLoading(false);
            }
        });

        return () => {
            // Cleanup if component unmounts
            if (slotRef.current) {
                window.googletag?.cmd.push(() => {
                    if (slotRef.current) {
                        window.googletag.destroySlots([slotRef.current]);
                        definedNativeSlots.delete(slotId);
                    }
                });
            }
        };
    }, [slotId]);

    /**
     * Extract native ad data from the rendered GAM slot
     * GAM renders native creatives with data attributes we can read
     */
    const extractNativeData = (elementId: string) => {
        const container = document.getElementById(elementId);
        if (!container) {
            setHasError(true);
            setIsLoading(false);
            return;
        }

        // GAM native ads expose data via the rendered iframe/content
        // Try to find native ad elements (this varies by GAM setup)
        const iframe = container.querySelector('iframe');

        if (iframe) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                    // Look for common native ad data attributes
                    const headline = iframeDoc.querySelector('[data-native-headline]')?.textContent ||
                        iframeDoc.querySelector('.native-headline')?.textContent ||
                        iframeDoc.querySelector('h1, h2, h3')?.textContent;

                    const image = iframeDoc.querySelector('[data-native-image]')?.getAttribute('src') ||
                        iframeDoc.querySelector('.native-image img')?.getAttribute('src') ||
                        iframeDoc.querySelector('img')?.getAttribute('src');

                    const body = iframeDoc.querySelector('[data-native-body]')?.textContent ||
                        iframeDoc.querySelector('.native-body')?.textContent ||
                        iframeDoc.querySelector('p')?.textContent;

                    const clickUrl = iframeDoc.querySelector('a')?.getAttribute('href') || '#';

                    if (headline && image) {
                        setAdData({
                            headline,
                            image,
                            body: body || undefined,
                            clickUrl,
                        });
                        setIsLoading(false);
                        return;
                    }
                }
            } catch {
                // Cross-origin iframe - cannot access content
            }
        }

        // Fallback: mark as error if we can't extract data
        setHasError(true);
        setIsLoading(false);
    };

    // Don't render if error
    if (hasError) {
        return null;
    }

    // Loading skeleton matching ProductGridItem
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
                {/* Hidden container for GAM to render into */}
                <div id={slotId} ref={containerRef} className="hidden" />
            </div>
        );
    }

    // Convert ad to product format
    const adProduct = nativeAdToProduct(adData, 0);

    // Handle sponsored click - go to advertiser URL
    const handleSponsoredClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(adData.clickUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className={`relative group ${className}`}>
            {/* Sponsored Badge Overlay - Required by Google Policy */}
            <div className="absolute top-5 left-5 z-30 bg-gray-900/90 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm shadow-lg">
                Sponsored
            </div>

            {/* Advertiser click overlay */}
            <a
                href={adData.clickUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="absolute inset-0 z-20"
                onClick={handleSponsoredClick}
                aria-label={`Sponsored: ${adProduct.name}`}
            />

            {/* Render using actual ProductGridItem (pointer-events-none to let overlay handle clicks) */}
            <div className="pointer-events-none">
                <ProductGridItem
                    product={adProduct}
                    onAddToCart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // For sponsored products, clicking cart also goes to advertiser
                        window.open(adData.clickUrl, '_blank', 'noopener,noreferrer');
                    }}
                    isAdded={false}
                    cartQuantity={0}
                    viewMode="grid"
                    isWishlisted={false}
                    onToggleWishlist={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    storeSlug={storeSlug}
                />
            </div>

            {/* Hidden container for GAM to render into */}
            <div id={slotId} ref={containerRef} className="hidden" />
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
    const adProduct = nativeAdToProduct(ad, 0);

    return (
        <div className={`relative group ${className}`}>
            {/* Sponsored Badge Overlay */}
            <div className="absolute top-5 left-5 z-30 bg-gray-900/90 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm shadow-lg">
                Sponsored
            </div>

            {/* Advertiser click overlay */}
            <a
                href={ad.clickUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="absolute inset-0 z-20"
                aria-label={`Sponsored: ${adProduct.name}`}
            />

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
                    storeSlug={storeSlug}
                />
            </div>
        </div>
    );
};

export default NativeProductAd;
