import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { loadStoreReadiness } from '@/lib/store-readiness/load-store-readiness';
import { storeReadinessQuerySchema } from '@/schemas/store-readiness-query';

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsedQuery = storeReadinessQuerySchema.safeParse({
    merchantId: request.nextUrl.searchParams.get('merchantId') ?? undefined,
    surface: request.nextUrl.searchParams.get('surface') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Invalid readiness query', code: 'INVALID_READINESS_QUERY' },
      { status: 400 }
    );
  }

  try {
    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id,
      { requestedMerchantId: parsedQuery.data.merchantId }
    );
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'dashboard', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const readiness = await loadStoreReadiness({
      supabase: auth.supabase,
      merchantId: merchantContext.merchantId,
      access,
      surface: parsedQuery.data.surface,
    });
    return NextResponse.json(readiness);
  } catch (error) {
    console.error('[Readiness API] request failed', error);
    return NextResponse.json(
      {
        error: 'Failed to load store readiness',
        code: 'READINESS_LOAD_FAILED',
      },
      { status: 500 }
    );
  }
}
