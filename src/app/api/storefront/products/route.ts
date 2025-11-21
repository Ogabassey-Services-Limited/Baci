import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const merchantId = searchParams.get('merchant_id');

        if (!merchantId) {
            return NextResponse.json({ error: 'Merchant ID is required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Fetch published products for this merchant
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('merchant_id', merchantId)
            .eq('is_active', true) // Only published products
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching storefront products:', error);
            return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
        }

        // Map to Product interface
        const mappedProducts = products.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            image: p.image_small,
            imageLarge: p.image_large,
            imageHint: p.image_hint,
            category: p.category || 'General',
            status: 'published', // We filtered by is_active=true
            has_variants: p.has_variants,
            // We could fetch variants here too if needed for the list, 
            // but for now let's keep it simple.
        }));

        return NextResponse.json({ products: mappedProducts });

    } catch (error) {
        console.error('Unexpected error in GET /api/storefront/products:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
