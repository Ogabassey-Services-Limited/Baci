import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import { JumiaClient, JumiaCreateProductSchema } from '@/lib/jumia/client';
import { createAdminClient } from '@/lib/supabase/admin';

const ExportSchema = z.object({
  merchantId: z.string().uuid(),
  productData: JumiaCreateProductSchema,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { merchantId, productData } = ExportSchema.parse(body);
    const _cookieStore = await cookies();

    // 1. Initialize Client
    const supabase = createAdminClient();
    const jumia = await JumiaClient.forMerchant(merchantId);

    if (!jumia) {
      return NextResponse.json(
        {
          error:
            'No active Jumia integration found for this merchant. Please connect Jumia in Settings.',
        },
        { status: 404 }
      );
    }

    // 2. Create Product on Jumia
    const feedId = await jumia.createProduct(productData);

    // 3. Create Mapping (Pending Status)
    // We don't have the Jumia Product ID yet, we only have the SellerSku and Feed ID.
    // We will assume "pending" until the next sync or webhook confirms it.

    // Check if product exists in Baci to link it
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('sku', productData.SellerSku)
      .single();

    if (existingProduct) {
      await supabase.from('jumia_product_mappings').upsert(
        {
          merchant_id: merchantId,
          product_id: existingProduct.id,
          jumia_sku: productData.SellerSku,
          jumia_seller_sku: productData.SellerSku,
          jumia_shop_id: jumia.getShopId(),
          jumia_price: productData.Price,
          sync_status: 'pending', // Feed processing
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'merchant_id, product_id, jumia_shop_id' }
      ); // Adjust constraint if needed
    }

    return NextResponse.json({
      success: true,
      feedId,
      message:
        'Product export initiated. Check Jumia Vendor Center for status.',
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}
