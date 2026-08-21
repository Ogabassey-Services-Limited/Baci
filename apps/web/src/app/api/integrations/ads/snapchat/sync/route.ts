import { type NextRequest, NextResponse } from 'next/server';
import { SnapchatAdsConfigError } from '@/lib/ads/snapchat/config';
import { SnapchatAdsProviderError } from '@/lib/ads/snapchat/provider';
import {
  SnapchatAdsSyncError,
  syncSnapchatAdsSpendForMerchant,
} from '@/lib/ads/snapchat/sync';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { snapchatAdsSyncRequestSchema } from '@/schemas/snapchat-ads';
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase)
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid)
    return (
      csrf.response ??
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    );
  const access = await getUserAccess(auth.supabase);
  if (!access)
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  if (!hasPermission(access, 'integrations', 'manage'))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const parsed = snapchatAdsSyncRequestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  try {
    return NextResponse.json({
      ...(await syncSnapchatAdsSpendForMerchant({
        ...parsed.data,
        merchantId: access.merchantId,
        supabase: auth.supabase,
      })),
      synced: true,
    });
  } catch (error) {
    if (error instanceof SnapchatAdsConfigError)
      return NextResponse.json(
        { error: 'Snapchat Ads integration unavailable' },
        { status: 503 }
      );
    if (error instanceof SnapchatAdsSyncError)
      return NextResponse.json(
        { error: error.code },
        {
          status:
            error.code === 'SNAPCHAT_ADS_ACCOUNT_NOT_SELECTED' ? 409 : 502,
        }
      );
    return NextResponse.json(
      {
        error:
          error instanceof SnapchatAdsProviderError
            ? error.code
            : 'Snapchat Ads sync failed',
      },
      { status: 502 }
    );
  }
}
