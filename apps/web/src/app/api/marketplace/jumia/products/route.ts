import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getUserAccess, hasPermission } from '@/lib/api-auth';
import { JumiaClient } from '@/lib/jumia/client';
import { JumiaApiError } from '@/lib/jumia/helpers';
import {
  loadIntegrationScopedMappings,
  pickPrimaryProductMapping,
} from '@/lib/jumia/product-mapping-scope';
import { createClient } from '@/lib/supabase/server';
import { jumiaProductQuerySchema } from '@/schemas/jumia-product-query';

export async function GET(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = jumiaProductQuerySchema.safeParse({
    productId: searchParams.get('productId'),
    integrationId: searchParams.get('integrationId'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Product ID and integration ID are required' },
      { status: 400 }
    );
  }

  const access = await getUserAccess(supabase);
  if (!access || !hasPermission(access, 'integrations', 'view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { productId, integrationId } = parsed.data;

  try {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('merchant_id')
      .eq('id', productId)
      .eq('merchant_id', access.merchantId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let client: JumiaClient;
    try {
      client = await JumiaClient.forIntegration(
        supabase,
        product.merchant_id,
        integrationId
      );
    } catch (err: unknown) {
      if (err instanceof JumiaApiError && err.status === 404) {
        return NextResponse.json(
          { error: `Jumia integration not found: ${integrationId}` },
          { status: 404 }
        );
      }
      throw err;
    }

    const { mappings, error: mappingError } =
      await loadIntegrationScopedMappings({
        supabase,
        merchantId: product.merchant_id,
        productId,
        shopId: client.shopId,
        marketplaceKey: client.marketplaceKey,
      });

    if (mappingError) {
      console.error('Error fetching Jumia mapping:', mappingError);
      return NextResponse.json(
        { error: 'Failed to fetch mapping' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      mapping: pickPrimaryProductMapping(mappings),
      mappings,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
