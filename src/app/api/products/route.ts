import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get merchant record
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json(
                { error: 'Merchant not found' },
                { status: 404 }
            );
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || 'All';
        const stock = searchParams.get('stock') || 'All';

        const offset = (page - 1) * limit;

        // Build query
        let query = supabase
            .from('products')
            .select('*', { count: 'exact' })
            .eq('merchant_id', merchant.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Apply filters
        if (status !== 'All') {
            // Map UI status to DB status if needed, or assume they match
            // DB: is_active (boolean) vs UI: published/draft/archived
            // This might need adjustment based on actual DB schema for status
            // For now, assuming 'is_active' maps to 'published'
            if (status === 'published') {
                query = query.eq('is_active', true);
            } else if (status === 'draft') {
                query = query.eq('is_active', false); // Simplified mapping
            }
            // Note: The current DB schema only has is_active (boolean). 
            // A real implementation would need a 'status' text column to support draft/archived properly.
        }

        if (stock !== 'All') {
            if (stock === 'out_of_stock') {
                query = query.eq('stock_quantity', 0);
            } else if (stock === 'in_stock') {
                query = query.gt('stock_quantity', 0);
            }
        }

        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        const { data: products, error, count } = await query;

        if (error) {
            console.error('Error fetching products:', error);
            return NextResponse.json(
                { error: 'Failed to fetch products' },
                { status: 500 }
            );
        }

        // Transform to match UI Product interface
        const transformedProducts = products?.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            status: p.is_active ? 'published' : 'draft', // Simplified mapping
            price: parseFloat(p.price),
            manage_stock: true, // Defaulting to true as DB has stock_quantity
            stock: p.stock_quantity,
            image: p.image_small || 'https://picsum.photos/seed/placeholder/80/80',
            imageLarge: p.image_large || 'https://picsum.photos/seed/placeholder/600/400',
            imageHint: p.image_hint || '',
            brand: 'Generic', // DB doesn't have brand yet
            gtin: '',
            mpn: '',
            has_variants: p.has_variants || false,
            category: p.category || 'General',
        })) || [];

        // Calculate stats (this might be expensive on large datasets, consider caching or separate endpoint)
        const { data: allStats, error: _statsError } = await supabase
            .from('products')
            .select('price, stock_quantity, is_active, category')
            .eq('merchant_id', merchant.id);

        let inventoryValue = 0;
        let outOfStockCount = 0;
        let categoryCount = 0;

        if (allStats) {
            inventoryValue = allStats.reduce((acc, curr) => {
                // Assuming is_active means "manage_stock" is true for now, or just counting all stock
                if (curr.stock_quantity > 0) {
                    return acc + (Number(curr.price) * curr.stock_quantity);
                }
                return acc;
            }, 0);
            outOfStockCount = allStats.filter(p => p.stock_quantity === 0).length;

            // Calculate unique categories
            const uniqueCategories = new Set(allStats.map(p => p.category).filter(Boolean));
            categoryCount = uniqueCategories.size;
        }

        return NextResponse.json({
            products: transformedProducts,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
            stats: {
                inventoryValue,
                outOfStockCount,
                categoryCount
            }
        });

    } catch (error) {
        console.error('Unexpected error in GET /api/products:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get merchant record
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json(
                { error: 'Merchant not found' },
                { status: 404 }
            );
        }

        const body = await request.json();

        // Basic validation
        if (!body.name || body.price === undefined) {
            return NextResponse.json(
                { error: 'Name and Price are required' },
                { status: 400 }
            );
        }

        // Insert Product
        const { data: product, error: productError } = await supabase
            .from('products')
            .insert({
                merchant_id: merchant.id,
                name: body.name,
                description: body.description,
                price: body.price,
                stock_quantity: body.stock,
                is_active: body.status === 'published',
                image_small: body.image,
                image_large: body.imageLarge,
                image_hint: body.imageHint,
                fulfillment_details: body.fulfillment_details,
                has_variants: body.has_variants || false,
                category: body.category,
                // brand: body.brand, // Assuming column exists or will be added
            })
            .select()
            .single();

        if (productError) {
            console.error('Error creating product:', productError);
            return NextResponse.json(
                { error: 'Failed to create product' },
                { status: 500 }
            );
        }

        // Insert Variants if any
        if (body.has_variants && body.variants && body.variants.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const variantsToInsert = body.variants.map((v: any) => ({
                product_id: product.id,
                merchant_id: merchant.id,
                attributes: v.attributes,
                price_override: v.price,
                stock_quantity: v.stock_quantity,
                sku: v.sku,
                primary_image: v.image,
                images: v.images || []
            }));

            const { error: variantsError } = await supabase
                .from('product_variants')
                .insert(variantsToInsert);

            if (variantsError) {
                console.error('Error creating variants:', variantsError);
                // Consider rolling back product creation here in a real transaction
            }
        }

        return NextResponse.json({ product }, { status: 201 });

    } catch (error) {
        console.error('Unexpected error in POST /api/products:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
