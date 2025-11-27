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
 * Handle GET requests for storefront products and return the mapped products for a given merchant.
 *
 * @param request - Incoming request whose URL must include a `merchant_id` query parameter.
 * @returns JSON response:
 * - On success (200): `{ products: Array< { id, name, description, price, image, imageLarge, imageHint, category, status, has_variants } > }`. The successful response includes a `Cache-Control` header (`public, s-maxage=300, stale-while-revalidate=3600`).
 * - On client error (400): `{ error: 'Merchant ID is required' }` when `merchant_id` is missing.
 * - On server error (500): `{ error: 'Internal server error' }` for unexpected failures.
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