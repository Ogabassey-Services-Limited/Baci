import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { generateSlug, generateProductSlug, generateProductSchema, generateMetaDescription } from '@/lib/seo-utils';
import { getCountryByCode } from '@/lib/countries';
import { Product } from '@/lib/products';
import { sanitizeSearchQuery, sanitizeLikePattern, sanitizeSchemaMarkup } from '@/lib/sanitize';

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
            .select('id, business_name')
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
        const searchRaw = searchParams.get('search') || '';
        // Sanitize search input to prevent SQL injection
        const search = searchRaw ? sanitizeSearchQuery(searchRaw) : '';
        const status = searchParams.get('status') || 'All';
        const stock = searchParams.get('stock') || 'All';

        const offset = (page - 1) * limit;

        // Build query
        let query = supabase
            .from('products')
            .select('*, variants:product_variants(*)', { count: 'exact' })
            .eq('merchant_id', merchant.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Apply filters
        if (status !== 'All') {
            query = query.eq('status', status);
        }

        if (stock !== 'All') {
            if (stock === 'out_of_stock') {
                query = query.eq('stock_quantity', 0);
            } else if (stock === 'in_stock') {
                query = query.gt('stock_quantity', 0);
            }
        }

        if (search && search.trim()) {
            const sanitizedPattern = sanitizeLikePattern(search);
            query = query.or(`name.ilike.%${sanitizedPattern}%,sku.ilike.%${sanitizedPattern}%`);
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
        const transformedProducts: Product[] = products?.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            status: p.status || (p.is_active ? 'active' : 'draft'), // Fallback for migration
            price: parseFloat(p.price),
            manage_stock: p.manage_stock ?? true,
            stock: p.stock_quantity,
            minimum_order_quantity: p.min_order_quantity,

            // Image handling
            image: p.images?.[0]?.url || p.image_small || 'https://picsum.photos/seed/placeholder/80/80',
            imageLarge: p.images?.[0]?.url || p.image_large || 'https://picsum.photos/seed/placeholder/600/400',
            imageHint: p.image_hint || '',
            images: p.images || [],

            brand: p.brand || '',
            gtin: p.gtin || '',
            mpn: p.mpn || '',
            google_product_category: p.google_product_category,

            has_variants: p.has_variants || false,
            // Map variants if they exist
            variants: p.variants?.map((v: Record<string, unknown>) => ({
                id: v.id,
                product_id: v.product_id,
                merchant_id: v.merchant_id,
                attributes: v.attributes,
                price_override: v.price_override,
                stock_quantity: v.stock_quantity,
                sku: v.sku,
                primary_image: v.primary_image,
                images: v.images
            })) || [],
            category: p.category || 'General',
            color: p.color,

            // New fields
            sku: p.sku,
            slug: p.slug,
            compare_at_price: p.compare_at_price ? parseFloat(p.compare_at_price) : undefined,
            cost_price: p.cost_price ? parseFloat(p.cost_price) : undefined,
            low_stock_threshold: p.low_stock_threshold,

            weight_value: p.weight_value ? parseFloat(p.weight_value) : undefined,
            weight_unit: p.weight_unit,
            dimensions: p.dimensions,

            taxable: p.taxable,
            tax_code: p.tax_code,

            condition: p.condition,
            condition_detail: p.condition_detail,

            meta_title: p.meta_title,
            meta_description: p.meta_description,
            keywords: p.keywords,
            canonical_url: p.canonical_url,
            schema_markup: p.schema_markup,
        })) || [];

        // Calculate stats
        const { data: allStats } = await supabase
            .from('products')
            .select('price, stock_quantity, status, category')
            .eq('merchant_id', merchant.id);

        let inventoryValue = 0;
        let outOfStockCount = 0;
        let categoryCount = 0;

        if (allStats) {
            inventoryValue = allStats.reduce((acc, curr) => {
                if (curr.stock_quantity > 0) {
                    return acc + (Number(curr.price) * curr.stock_quantity);
                }
                return acc;
            }, 0);
            outOfStockCount = allStats.filter(p => p.stock_quantity === 0).length;
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
            .select('id, business_name, country')
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

        // Prepare data for insertion
        // Generate slug with condition if not 'new'
        const slug = body.slug || generateProductSlug(body.name, body.condition, body.condition_detail);
        const sku = body.sku || generateSlug(body.name).toUpperCase().substring(0, 20); // Fallback SKU

        // Generate SEO data if missing
        const meta_description = body.meta_description || generateMetaDescription(body.description);
        const meta_title = body.meta_title || body.name;

        // Prepare product object for schema generation
        const productForSchema: Product = {
            id: '', // Placeholder
            name: body.name,
            description: body.description,
            price: body.price,
            stock: body.stock || 0,
            manage_stock: true,
            status: body.status || 'draft',
            image: body.images?.[0]?.url || '',
            imageLarge: body.images?.[0]?.url || '',
            imageHint: '',
            brand: body.brand || merchant.business_name,
            sku: sku,
            gtin: body.gtin,
            mpn: body.mpn,
            weight_value: body.weight_value,
            weight_unit: body.weight_unit,
            condition: body.condition,
            images: body.images
        };

        const country = merchant.country ? getCountryByCode(merchant.country) : undefined;
        const currency = country ? country.currency : 'USD';
        // Sanitize user-provided schema_markup to prevent XSS (defense in depth)
        const schema_markup = body.schema_markup
            ? sanitizeSchemaMarkup(body.schema_markup)
            : generateProductSchema(productForSchema, merchant.business_name, currency);

        // Insert Product
        const { data: product, error: productError } = await supabase
            .from('products')
            .insert({
                merchant_id: merchant.id,
                name: body.name,
                description: body.description,
                price: body.price,
                stock_quantity: body.stock,

                // New fields
                sku: sku,
                slug: slug,
                compare_at_price: body.compare_at_price,
                cost_price: body.cost_price,
                low_stock_threshold: body.low_stock_threshold ?? 5,

                images: body.images || [],
                // Legacy image fields for backward compatibility
                image_small: body.images?.[0]?.url || body.image,
                image_large: body.images?.[0]?.url || body.imageLarge,
                image_hint: body.imageHint,

                weight_value: body.weight_value,
                weight_unit: body.weight_unit,
                dimensions: body.dimensions,

                status: body.status || 'draft',
                // Legacy is_active for backward compatibility
                is_active: body.status === 'active',

                taxable: body.taxable ?? true,
                tax_code: body.tax_code,

                condition: body.condition || 'new',
                condition_detail: body.condition_detail,

                meta_title: meta_title,
                meta_description: meta_description,
                keywords: body.keywords,
                canonical_url: body.canonical_url,
                schema_markup: schema_markup,

                gtin: body.gtin,
                mpn: body.mpn,
                google_product_category: body.google_product_category,
                brand: body.brand,

                fulfillment_details: body.fulfillment_details,
                has_variants: body.has_variants || false,
                category: body.category,
                color: body.color,
            })
            .select()
            .single();

        if (productError) {
            console.error('Error creating product:', productError);
            return NextResponse.json(
                { error: 'Failed to create product', details: productError.message },
                { status: 500 }
            );
        }

        // Insert Variants if any
        if (body.has_variants && body.variants && body.variants.length > 0) {
            const variantsToInsert = body.variants.map((v: Record<string, unknown>) => ({
                product_id: product.id,
                merchant_id: merchant.id,
                attributes: v.attributes,
                price_override: v.price,
                cost_price: v.cost_price, // New field
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
