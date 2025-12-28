
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { MERCHANT_SLUG } from '../lib/constants';
import { Merchant, Product, Category } from '../types/storefront';

export const STORE_KEYS = {
    merchant: (slug: string) => ['merchant', slug],
    categories: (merchantId: string) => ['categories', merchantId],
    products: (merchantId: string, filters?: any) => ['products', merchantId, filters],
};

export function useMerchant() {
    return useQuery({
        queryKey: STORE_KEYS.merchant(MERCHANT_SLUG),
        queryFn: async () => {
            console.log('[useMerchant] Fetching merchant:', MERCHANT_SLUG);
            const { data, error } = await supabase
                .from('merchants')
                .select('*')
                .eq('slug', MERCHANT_SLUG)
                .single();

            if (error) {
                console.error('[useMerchant] Error:', error);
                throw error;
            }
            console.log('[useMerchant] Success:', data?.id, data?.business_name);
            return data as Merchant;
        },
    });
}

/**
 * Fetch categories for the merchant based on products they have
 */
export function useCategories(merchantId?: string) {
    return useQuery({
        queryKey: STORE_KEYS.categories(merchantId || ''),
        queryFn: async () => {
            if (!merchantId) return [];

            // Get distinct categories from products via the many-to-many join
            const { data, error } = await supabase
                .from('product_categories')
                .select(`
                    categories:category_id (
                        id,
                        name,
                        slug
                    )
                `)
                .eq('products.merchant_id', merchantId);

            if (error) {
                console.log('[useCategories] Join failed, using fallback categories');
                // Fallback: return default category list matching web
                return [
                    { id: 'all', name: 'All', slug: 'all' },
                    { id: 'phones', name: 'Phones', slug: 'phones' },
                    { id: 'gaming', name: 'Gaming', slug: 'gaming' },
                    { id: 'laptops', name: 'Laptops', slug: 'laptops' },
                    { id: 'accessories', name: 'Accessories', slug: 'accessories' },
                ] as Category[];
            }

            // Dedupe and add "All" option
            const uniqueCategories = new Map<string, Category>();
            uniqueCategories.set('all', { id: 'all', name: 'All', slug: 'all' });

            data?.forEach((item: any) => {
                const cat = item.categories;
                if (cat && !uniqueCategories.has(cat.id)) {
                    uniqueCategories.set(cat.id, cat);
                }
            });

            return Array.from(uniqueCategories.values());
        },
        enabled: !!merchantId,
    });
}

interface ProductFilters {
    category?: string;
    brand?: string;
    condition?: string;
    minPrice?: number;
    maxPrice?: number;
    rating?: number;
    search?: string;
}

/**
 * Fetch products with server-side filtering and pagination
 */
export function useProducts(merchantId?: string, filters?: ProductFilters) {
    return useInfiniteQuery({
        queryKey: STORE_KEYS.products(merchantId || '', filters),
        queryFn: async ({ pageParam = 0 }) => {
            if (!merchantId) return [];

            const PAGE_SIZE = 20;
            const from = pageParam * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            console.log('[useProducts] Fetching page:', pageParam, 'range:', from, '-', to, 'filters:', filters);

            let query = supabase
                .from('products')
                .select(`
                    id,
                    name,
                    slug,
                    description,
                    price,
                    compare_at_price,
                    images,
                    status,
                    brand,
                    condition,
                    stock,
                    category
                `)
                .eq('merchant_id', merchantId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .range(from, to);

            // Apply Filters
            if (filters?.category && filters.category !== 'All' && filters.category !== 'all') {
                query = query.ilike('category', `%${filters.category}%`);
            }

            if (filters?.brand && filters.brand !== 'All') {
                query = query.ilike('brand', `%${filters.brand}%`);
            }

            if (filters?.condition && filters.condition !== 'All') {
                query = query.ilike('condition', `%${filters.condition}%`);
            }

            if (filters?.minPrice && filters.minPrice > 0) {
                query = query.gte('price', filters.minPrice);
            }

            if (filters?.maxPrice && filters.maxPrice > 0) {
                query = query.lte('price', filters.maxPrice);
            }

            // Search filter
            if (filters?.search) {
                query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[useProducts] Error:', error);
                throw error;
            }

            return data as Product[];
        },
        getNextPageParam: (lastPage, allPages) => {
            // If the last page has fewer items than PAGE_SIZE, it's the last page
            if (!lastPage || lastPage.length < 20) return undefined;
            return allPages.length;
        },
        initialPageParam: 0,
        enabled: !!merchantId,
    });
}
