import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { generateSlug, generateProductSchema, generateMetaDescription } from '@/lib/seo-utils';
import { getCountryByCode } from '@/lib/countries';
import { Product } from '@/lib/products';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: merchant } = await supabase
            .from('merchants')
            .select('id, business_name')
            .eq('user_id', user.id)
            .single();

        if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

        // Try to find by ID first, then by slug
        let query = supabase
            .from('products')
            .select('*')
            .eq('merchant_id', merchant.id);

        // Check if id is a UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        if (isUuid) {
            query = query.eq('id', id);
        } else {
            query = query.eq('slug', id);
        }

        const { data: product, error: productError } = await query.single();

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let variants: any[] = [];
        if (product.has_variants) {
            const { data: v } = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', product.id);
            variants = v || [];
        }

        const fullProduct: Product = {
            id: product.id,
            name: product.name,
            description: product.description || '',
            status: product.status || (product.is_active ? 'active' : 'draft'),
            price: parseFloat(product.price),
            manage_stock: product.manage_stock ?? true,
            stock: product.stock_quantity,
            minimum_order_quantity: product.min_order_quantity,

            image: product.images?.[0]?.url || product.image_small || 'https://picsum.photos/seed/placeholder/80/80',
            imageLarge: product.images?.[0]?.url || product.image_large || 'https://picsum.photos/seed/placeholder/600/400',
            imageHint: product.image_hint || '',
            images: product.images || [],

            brand: product.brand || '',
            gtin: product.gtin || '',
            mpn: product.mpn || '',
            google_product_category: product.google_product_category,

            has_variants: product.has_variants || false,
            category: product.category || 'General',

            sku: product.sku,
            slug: product.slug,
            compare_at_price: product.compare_at_price ? parseFloat(product.compare_at_price) : undefined,
            cost_price: product.cost_price ? parseFloat(product.cost_price) : undefined,
            low_stock_threshold: product.low_stock_threshold,

            weight_value: product.weight_value ? parseFloat(product.weight_value) : undefined,
            weight_unit: product.weight_unit,
            dimensions: product.dimensions,

            taxable: product.taxable,
            tax_code: product.tax_code,

            condition: product.condition,
            condition_detail: product.condition_detail,

            meta_title: product.meta_title,
            meta_description: product.meta_description,
            keywords: product.keywords,
            canonical_url: product.canonical_url,
            schema_markup: product.schema_markup,

            variants: variants.map(v => ({
                id: v.id,
                product_id: v.product_id,
                merchant_id: v.merchant_id,
                attributes: v.attributes,
                price_override: v.price_override,
                cost_price: v.cost_price,
                stock_quantity: v.stock_quantity,
                sku: v.sku,
                primary_image: v.primary_image,
                images: v.images || []
            }))
        };

        return NextResponse.json({ product: fullProduct });

    } catch (error) {
        console.error('Error in GET /api/products/[id]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get merchant record
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id, business_name, country')
            .eq('user_id', user.id)
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
        }

        // Verify product belongs to merchant
        const { data: existingProduct, error: fetchError } = await supabase
            .from('products')
            .select('id')
            .eq('id', id)
            .eq('merchant_id', merchant.id)
            .single();

        if (fetchError || !existingProduct) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Prepare updates
        const slug = body.slug || generateSlug(body.name);
        const sku = body.sku || (body.name ? generateSlug(body.name).toUpperCase().substring(0, 20) : undefined);

        const meta_description = body.meta_description || generateMetaDescription(body.description);
        const meta_title = body.meta_title || body.name;

        // Prepare product object for schema generation
        const productForSchema: Product = {
            id: id,
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
        const schema_markup = body.schema_markup || generateProductSchema(productForSchema, merchant.business_name, currency);

        // Update product
        const updates = {
            name: body.name,
            description: body.description,
            price: body.price,
            stock_quantity: body.stock,

            // New fields
            sku: sku,
            slug: slug,
            compare_at_price: body.compare_at_price,
            cost_price: body.cost_price,
            low_stock_threshold: body.low_stock_threshold,

            images: body.images || [],
            image_small: body.images?.[0]?.url || body.image,
            image_large: body.images?.[0]?.url || body.imageLarge,
            image_hint: body.imageHint,

            weight_value: body.weight_value,
            weight_unit: body.weight_unit,
            dimensions: body.dimensions,

            status: body.status || 'draft',
            is_active: body.status === 'active',

            taxable: body.taxable,
            tax_code: body.tax_code,

            condition: body.condition,
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
            has_variants: body.has_variants,
            category: body.category,
            updated_at: new Date().toISOString(),
        };

        const { data: updatedProduct, error: updateError } = await supabase
            .from('products')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating product:', updateError);
            return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
        }

        // Handle Variants
        if (body.has_variants && body.variants) {
            // 1. Get IDs of variants to keep
            const variantIdsToKeep = body.variants
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((v: any) => v.id)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((v: any) => v.id);

            // 2. Delete variants not in the list
            if (variantIdsToKeep.length > 0) {
                await supabase
                    .from('product_variants')
                    .delete()
                    .eq('product_id', id)
                    .not('id', 'in', `(${variantIdsToKeep.join(',')})`);
            } else {
                await supabase
                    .from('product_variants')
                    .delete()
                    .eq('product_id', id);
            }

            // 3. Separate updates and inserts
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const variantsToUpsert = body.variants.map((v: any) => ({
                id: v.id,
                product_id: id,
                merchant_id: merchant.id,
                attributes: v.attributes,
                price_override: v.price,
                cost_price: v.cost_price, // New field
                stock_quantity: v.stock_quantity,
                sku: v.sku,
                primary_image: v.image,
                images: v.images || []
            }));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const variantsToUpdate = variantsToUpsert.filter((v: any) => v.id);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const variantsToInsert = variantsToUpsert.filter((v: any) => !v.id);

            if (variantsToUpdate.length > 0) {
                const { error: updateVarError } = await supabase
                    .from('product_variants')
                    .upsert(variantsToUpdate);
                if (updateVarError) console.error('Error updating variants:', updateVarError);
            }

            if (variantsToInsert.length > 0) {
                const { error: insertVarError } = await supabase
                    .from('product_variants')
                    .insert(variantsToInsert);
                if (insertVarError) console.error('Error inserting variants:', insertVarError);
            }
        } else if (body.has_variants === false) {
            await supabase
                .from('product_variants')
                .delete()
                .eq('product_id', id);
        }

        return NextResponse.json({ product: updatedProduct });

    } catch (error) {
        console.error('Unexpected error in PUT /api/products/[id]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
        }

        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .eq('id', id)
            .eq('merchant_id', merchant.id);

        if (deleteError) {
            console.error('Error deleting product:', deleteError);
            return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Unexpected error in DELETE /api/products/[id]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
