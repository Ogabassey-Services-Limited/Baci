/**
 * @fileOverview Engine-Connected Product Grid for New Template
 *
 * Connects the InteractiveProductGrid to the Baci e-commerce engine.
 */

'use client';

import React, { useEffect, useState } from 'react';
import type { Product as BaciProduct } from '@/lib/products';
import { getEffectiveStock } from '@/lib/product-stock';
import { formatCurrency } from '@/lib/utils';
import { products as mockProducts } from './data';
import { InteractiveProductGrid } from './interactive-product-grid';
import type { Product } from './types';

/**
 * Transform Baci products to template format
 */
function toTemplateProducts(baciProducts: BaciProduct[]): Product[] {
    return baciProducts.map((p) => ({
        id: p.id,
        name: p.name,
        price: formatCurrency(p.price),
        rawPrice: p.price / 100,
        image: p.image,
        category: (p as any).categories?.name || p.category || 'General',
        rating: p.rating ?? 4.5,
        reviews: p.review_count ?? 0,
        description: p.description,
        brand: p.brand,
        inStock: p.manage_stock === false || getEffectiveStock(p) > 0,
        isNew: p.condition === 'new',
        colors: p.colors?.map(c => ({ name: c, value: c.toLowerCase() })),
        storage: p.storage_options,
        // Map basic specs
        specs: {
            brand: p.brand,
            condition: p.condition_detail || p.condition || 'New',
        },
    }));
}

/** Demo slugs that should use mock data instead of live API */
const DEMO_SLUGS = new Set([
    'ogabassey',
    'new-template-demo',
    'premium-default',
]);

/**
 * Fetches live products for a store, falling back to mock data when the API
 * returns nothing or fails. Module-scope so the try/catch with throw stays
 * outside the component body (React Compiler cannot lower it yet).
 */
async function fetchEngineProducts(
    storeSlug: string,
    limit: number
): Promise<Product[]> {
    try {
        const params = new URLSearchParams({
            limit: String(limit),
            compact: 'true',
            has_images: 'true',
        });
        const response = await fetch(`/api/storefront/${storeSlug}/products?${params}`);

        if (!response.ok) throw new Error('Failed to fetch products');

        const data = await response.json();
        if (data.products && Array.isArray(data.products)) {
            return toTemplateProducts(data.products);
        }
        // Fallback to mock data if no products returned
        return mockProducts;
    } catch (err) {
        console.error('Error fetching products:', err);
        // Fallback to mock data on error
        return mockProducts;
    }
}

interface EngineProductGridProps {
    storeSlug?: string;
    /** Use mock data instead of fetching from API */
    useMockData?: boolean;
    title?: string;
    limit?: number;
}

export const EngineProductGrid: React.FC<EngineProductGridProps> = ({
    storeSlug,
    useMockData = false,
    title = 'Featured Products',
    limit = 8,
}) => {
    // Mock mode, missing slug, or demo slug renders static mock products —
    // derived during render instead of mirrored into state via an effect.
    const useStaticProducts =
        useMockData || !storeSlug || DEMO_SLUGS.has(storeSlug);
    const fetchKey = useStaticProducts ? null : `${storeSlug}:${limit}`;

    const [fetchedProducts, setFetchedProducts] = useState<Product[] | null>(
        null
    );
    const [prevFetchKey, setPrevFetchKey] = useState(fetchKey);

    // Drop stale results inline when the fetch inputs change (prev-prop
    // comparison during render, before return) so users never see a frame of
    // the previous store's products.
    if (fetchKey !== prevFetchKey) {
        setPrevFetchKey(fetchKey);
        setFetchedProducts(null);
    }

    useEffect(() => {
        if (useStaticProducts || !storeSlug) {
            return;
        }

        let cancelled = false;
        fetchEngineProducts(storeSlug, limit).then((products) => {
            if (!cancelled) {
                setFetchedProducts(products);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [useStaticProducts, storeSlug, limit]);

    const products = useStaticProducts ? mockProducts : fetchedProducts;

    if (products === null) {
        return (
            <div className="max-w-[1400px] mx-auto px-4 py-12 text-center text-gray-400">
                Loading products…
            </div>
        );
    }

    return (
        <InteractiveProductGrid
            products={products.length > 0 ? products : undefined}
            title={title}
        />
    );
};
