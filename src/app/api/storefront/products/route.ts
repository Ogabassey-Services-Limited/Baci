import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

// Cached function to fetch products for a merchant
const getCachedProducts = unstable_cache(
    async (merchantId: string) => {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('merchant_id', merchantId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return products.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            image: p.image_small,
            imageLarge: p.image_large,
            imageHint: p.image_hint,
            category: p.category || 'General',
            status: 'published',
            has_variants: p.has_variants,
        }));
    },
    ['storefront-products'], // cache key
    {
        revalidate: 300, // Revalidate every 5 minutes
        tags: ['storefront-products'],
    }
);

/**
 * Handle GET requests for storefront products and return products for a specified merchant.
 *
 * Fetches active products for the merchant identified by the `merchant_id` query parameter and returns them as JSON with caching headers. If `merchant_id` is missing, responds with a 400 error. On unexpected failures, responds with a 500 error.
 *
 * @returns A NextResponse containing `{ products: Product[] }` on success; a JSON error object with status 400 when `merchant_id` is missing; a JSON error object with status 500 on unexpected errors.
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const merchantId = searchParams.get('merchant_id');

        if (!merchantId) {
            return NextResponse.json({ error: 'Merchant ID is required' }, { status: 400 });
        }

        const mappedProducts = await getCachedProducts(merchantId);

        return NextResponse.json(
            { products: mappedProducts },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
                },
            }
        );

    } catch (error) {
        console.error('Unexpected error in GET /api/storefront/products:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}