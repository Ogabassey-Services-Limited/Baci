import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

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
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .eq('merchant_id', merchant.id)
            .single();

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let variants: any[] = [];
        if (product.has_variants) {
            const { data: v } = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', id);
            variants = v || [];
        }

        const fullProduct = {
            ...product,
            stock: product.stock_quantity,
            image: product.image_small,
            imageLarge: product.image_large,
            imageHint: product.image_hint,
            variants: variants.map(v => ({
                ...v,
                price: v.price_override,
                image: v.primary_image
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
            .select('id')
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

        // Update product
        // Map UI fields to DB fields
        const updates = {
            name: body.name,
            description: body.description,
            price: body.price,
            stock_quantity: body.stock,
            is_active: body.status === 'published', // Simplified mapping
            image_small: body.image, // Assuming image is small for now
            image_large: body.imageLarge || body.image,
            image_hint: body.imageHint,
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
            // 1. Get IDs of variants to keep (from the incoming list)
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
                // If no IDs to keep, delete all existing variants (assuming full replacement or new variants only)
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
            // If variants disabled, delete all variants
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

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get merchant record
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
        }

        // Delete product (RLS should handle merchant check, but good to be explicit)
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
