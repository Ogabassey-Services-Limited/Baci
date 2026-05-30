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
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProducts() {
            // If using mock data, no storeSlug, or demo slug, use static mock products
            if (useMockData || !storeSlug || DEMO_SLUGS.has(storeSlug)) {
                setProducts(mockProducts);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const params = new URLSearchParams({
                    limit: String(limit),
                    compact: 'true',
                    has_images: 'true',
                });
                const response = await fetch(`/api/storefront/${storeSlug}/products?${params}`);

                if (!response.ok) throw new Error('Failed to fetch products');

                const data = await response.json();
                if (data.products && Array.isArray(data.products)) {
                    setProducts(toTemplateProducts(data.products));
                } else {
                    // Fallback to mock data if no products returned
                    setProducts(mockProducts);
                }
            } catch (err) {
                console.error('Error fetching products:', err);
                // Fallback to mock data on error
                setProducts(mockProducts);
            } finally {
                setLoading(false);
            }
        }

        fetchProducts();
    }, [storeSlug, limit]);

    if (loading) {
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
