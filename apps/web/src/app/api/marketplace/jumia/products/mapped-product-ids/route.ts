import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { requireMerchantFeatureAccess } from '@/lib/merchant-feature-gates';

const querySchema = z.object({
  integrationId: z.uuid(),
});

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    integrationId: request.nextUrl.searchParams.get('integrationId'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid integrationId' },
      { status: 400 }
    );
  }

  const merchantId = await getMerchantIdForApiUser(auth.supabase);
  if (!merchantId) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const featureGateResponse = await requireMerchantFeatureAccess(
    auth.supabase,
    merchantId,
    'marketplace_sync'
  );
  if (featureGateResponse) {
    return featureGateResponse;
  }

  const { data: integration, error: integrationError } = await auth.supabase
    .from('marketplace_integrations')
    .select('shop_id, marketplace_key')
    .eq('merchant_id', merchantId)
    .eq('id', parsed.data.integrationId)
    .eq('platform', 'jumia')
    .eq('is_active', true)
    .maybeSingle();

  if (integrationError) {
    return NextResponse.json(
      { error: 'Failed to load Jumia integration' },
      { status: 500 }
    );
  }

  if (!integration?.shop_id) {
    return NextResponse.json(
      { error: 'Jumia integration not found' },
      { status: 404 }
    );
  }

  const { data, error } = await auth.supabase
    .from('jumia_product_mappings')
    .select('product_id')
    .eq('merchant_id', merchantId)
    .eq('jumia_shop_id', integration.shop_id)
    .eq('marketplace_key', integration.marketplace_key ?? 'default');

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load mapped products' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    productIds: Array.from(
      new Set((data ?? []).map((row) => row.product_id).filter(Boolean))
    ),
  });
}
