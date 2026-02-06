import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { JumiaClient } from '@/lib/jumia/client';

const ImportSchema = z.object({
  integrationId: z.string().uuid(),
  merchantId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(req);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

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

    // Verify integrationId belongs to this merchant
    const { data: integration, error: integrationError } = await auth.supabase
      .from('marketplace_integrations')
      .select('id')
      .eq('id', integrationId)
      .eq('merchant_id', merchantId)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 403 }
      );
    }

    // 1. Initialize Clients
    const supabase = auth.supabase;
    const jumia = await JumiaClient.fromIntegration(
      integrationId,
      supabase,
      merchantId
    );

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
    let errors = 0;
    const updated = 0;

    const skus = jumiaProducts
      .map((jp) => jp.SellerSku)
      .filter((sku): sku is string => Boolean(sku));

    const { data: existingProducts } = await supabase
      .from('products')
      .select('id, sku')
      .eq('merchant_id', merchantId)
      .in('sku', skus);

    const productBySku = new Map(
      (existingProducts || []).filter((p) => p.sku).map((p) => [p.sku, p])
    );

    const { data: existingMappings } = await supabase
      .from('jumia_product_mappings')
      .select('id, jumia_sku')
      .eq('merchant_id', merchantId)
      .in('jumia_sku', skus);

    const mappedSkus = new Set(
      (existingMappings || [])
        .filter((m) => m.jumia_sku)
        .map((m) => m.jumia_sku)
    );

    // 3. Process each product
    for (const jp of jumiaProducts) {
      const sku = jp.SellerSku;
      if (!sku) continue;

      const product = productBySku.get(sku);
      const productId = product?.id;

      if (productId) {
        // LINK EXISTING
        if (mappedSkus.has(sku)) {
          // Already linked - maybe update price?
          // For now, just skip or mark updated if we built logic
        } else {
          // Create mapping
          const { error: mapError } = await supabase
            .from('jumia_product_mappings')
            .insert({
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
          if (mapError) {
            console.error(`Mapping insert failed for SKU ${sku}:`, mapError);
            errors++;
          } else {
            linked++;
            mappedSkus.add(sku);
          }
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

        if (createError || !newProduct) {
          console.error(`Product insert failed for SKU ${sku}:`, createError);
          errors++;
        } else {
          // Insert Mapping
          const { error: mapError } = await supabase
            .from('jumia_product_mappings')
            .insert({
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
          if (mapError) {
            console.error(`Mapping insert failed for SKU ${sku}:`, mapError);
            errors++;
          } else {
            created++;
          }
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
        errors,
      },
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
