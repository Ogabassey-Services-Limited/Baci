/**
 * @fileOverview Engine-Connected Product Grid for Lumina Template
 */

'use client';

import React from 'react';
import { useStorefrontProducts } from '@/hooks/use-storefront-products';
import { mockProducts } from './mock-data';
import { LuminaProductGrid } from './product/product-grid';

interface LuminaEngineGridProps {
    storeSlug?: string;
    /** Use mock data instead of fetching from API */
    useMockData?: boolean;
    title?: string;
    limit?: number;
}

export const LuminaEngineGrid: React.FC<LuminaEngineGridProps> = ({
    storeSlug,
    useMockData = false,
    title = 'Featured Products',
    limit = 12,
}) => {
    const { products: apiProducts, loading } = useStorefrontProducts({
        storeSlug: useMockData ? undefined : storeSlug,
        limit,
    });

    // Use mock data only when explicitly requested
    const products = useMockData ? mockProducts : apiProducts;

    if (loading && !useMockData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-400">Loading products...</div>
            </div>
        );
    }

    return (
        <LuminaProductGrid
            products={products}
            storeSlug={storeSlug}
            title={title}
        />
    );
};
