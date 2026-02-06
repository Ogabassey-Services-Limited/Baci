import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { JumiaClient } from '@/lib/jumia/client';

const ImportSchema = z.object({
  integrationId: z.string().uuid(),
  merchantId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiRequest(req);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { integrationId, merchantId: requestedMerchantId } =
      ImportSchema.parse(body);

    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (requestedMerchantId && requestedMerchantId !== merchantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Initialize Clients
    const supabase = auth.supabase;
    const jumia = await JumiaClient.fromIntegration(integrationId, supabase);

    // 2. Fetch all products from Jumia
    // Default to Active products, but could be configurable
    const jumiaProducts = await jumia.getProducts({ status: 'Active' });

    if (!jumiaProducts.length) {
      return NextResponse.json({
        success: true,
        summary: { total: 0, created: 0, linked: 0, updated: 0 },
      });
    }

    let created = 0;
    let linked = 0;
    const updated = 0;

    // 3. Process each product
    for (const jp of jumiaProducts) {
      const sku = jp.SellerSku;
      if (!sku) continue;

      // Check if product exists in Baci by SKU
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id, variants:product_variants(id, sku)')
        .eq('merchant_id', merchantId)
        .eq('sku', sku) // Simple SKU match on main product
        .single();

      // Also check variants if not found on main product (simplified for now to main product)
      // For 2026 BP, we should check variants too potentially, but starting simple.

      const productId = existingProduct?.id;

      if (productId) {
        // LINK EXISTING
        // Check if mapping exists
        const { data: mapping } = await supabase
          .from('jumia_product_mappings')
          .select('id')
          .eq('merchant_id', merchantId)
          .eq('jumia_sku', sku)
          .single();

        if (mapping) {
          // Already linked - maybe update price?
          // For now, just skip or mark updated if we built logic
        } else {
          // Create mapping
          await supabase.from('jumia_product_mappings').insert({
            merchant_id: merchantId,
            product_id: productId,
            jumia_sku: sku,
            jumia_seller_sku: sku,
            jumia_shop_id: jumia.getShopId(),
            jumia_price: Number.parseFloat(jp.Price?.toString() || '0'),
            jumia_product_id: 'unknown-uuid-from-fetch', // Jumia fetch doesn't always return UUID in simple feed, might need to rely on SKU
            is_active: jp.Status === 'Active',
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          });
          linked++;
        }
      } else {
        // CREATE NEW PRODUCT
        const price = Number.parseFloat(jp.Price?.toString() || '0');

        // Insert Product
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            merchant_id: merchantId,
            name: jp.Name || 'Imported Jumia Product',
            description: jp.Description || '',
            price: price,
            sku: sku,
            stock_level: Number.parseInt(
              String(jp.ProductData?.Quantity || '0'),
              10
            ),
            is_active: jp.Status === 'Active',
            images: jp.Images || (jp.MainImage ? [jp.MainImage] : []),
          })
          .select()
          .single();

        if (newProduct && !createError) {
          // Insert Mapping
          await supabase.from('jumia_product_mappings').insert({
            merchant_id: merchantId,
            product_id: newProduct.id,
            jumia_sku: sku,
            jumia_seller_sku: sku,
            jumia_shop_id: jumia.getShopId(),
            jumia_price: price,
            jumia_product_id: 'unknown-uuid-imp',
            is_active: jp.Status === 'Active',
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          });
          created++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: jumiaProducts.length,
        created,
        linked,
        updated,
      },
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
