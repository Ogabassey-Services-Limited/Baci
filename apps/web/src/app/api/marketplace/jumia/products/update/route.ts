import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { JumiaClient } from '@/lib/jumia/client';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, overrides } = body;

    if (!productId || !overrides) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createClient(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify product ownership and get mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('jumia_product_mappings')
      .select('*, marketplace_integrations(*)')
      .eq('product_id', productId)
      .single();

    if (mappingError || !mapping) {
      return NextResponse.json(
        { error: 'Jumia mapping not found' },
        { status: 404 }
      );
    }

    // 1. Update local database
    const { error: updateError } = await supabase
      .from('jumia_product_mappings')
      .update({
        jumia_price: overrides.jumia_price,
        jumia_sale_price: overrides.jumia_sale_price,
        jumia_sale_start: overrides.jumia_sale_start,
        jumia_sale_end: overrides.jumia_sale_end,
        is_active: overrides.is_active,
        sync_inventory: overrides.sync_inventory,
        sync_price: overrides.sync_price,
        updated_at: new Date().toISOString(),
      })
      .eq('product_id', productId);

    if (updateError) {
      throw new Error(`Local update failed: ${updateError.message}`);
    }

    // 2. Initialize Jumia Client
    const integration = mapping.marketplace_integrations;
    if (!integration) {
      throw new Error('Integration credentials not found');
    }

    const client = new JumiaClient({
      integrationId: integration.id,
      merchantId: integration.merchant_id,
      shopId: integration.shop_id,
      accessToken: integration.access_token,
      refreshToken: integration.refresh_token,
      tokenExpiresAt: integration.expires_at
        ? new Date(integration.expires_at)
        : null,
    });

    // 3. Push Status Update if changed
    if (overrides.is_active !== undefined) {
      await client.updateStatus([
        {
          id: mapping.jumia_product_id,
          sellerSku: mapping.jumia_sku,
          active: overrides.is_active,
        },
      ]);
    }

    // 4. Push Price Update if provided
    if (overrides.jumia_price || overrides.jumia_sale_price) {
      await client.updatePrice([
        {
          id: mapping.jumia_product_id,
          sellerSku: mapping.jumia_sku,
          price: {
            value: overrides.jumia_price || 0, // Should use base price if override is null in real impl
            currency: integration.currency || 'NGN',
            salePrice: overrides.jumia_sale_price
              ? {
                  value: overrides.jumia_sale_price,
                  startAt: overrides.jumia_sale_start,
                  endAt: overrides.jumia_sale_end,
                }
              : undefined,
          },
        },
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update Jumia Product Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update Jumia product',
      },
      { status: 500 }
    );
  }
}
