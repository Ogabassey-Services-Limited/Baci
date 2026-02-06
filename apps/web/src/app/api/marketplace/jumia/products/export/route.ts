import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { JumiaClient, JumiaCreateProductSchema } from '@/lib/jumia/client';

const ExportSchema = z.object({
  merchantId: z.string().uuid().optional(),
  productData: JumiaCreateProductSchema,
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
    const { merchantId: requestedMerchantId, productData } =
      ExportSchema.parse(body);

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

    // 1. Initialize Client
    const supabase = auth.supabase;
    const jumia = await JumiaClient.forMerchant(merchantId, { supabase });

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
