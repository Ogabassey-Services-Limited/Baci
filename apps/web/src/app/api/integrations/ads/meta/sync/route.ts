import { type NextRequest, NextResponse } from 'next/server';
import { resolveAdsMerchantAccess } from '@/lib/ads/merchant-context';
import { MetaAdsConfigError } from '@/lib/ads/meta/config';
import { MetaAdsProviderError } from '@/lib/ads/meta/provider';
import {
  MetaAdsSyncError,
  syncMetaAdsSpendForMerchant,
} from '@/lib/ads/meta/sync';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { metaAdsSyncRequestSchema } from '@/schemas/meta-ads';

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
  const merchant = await resolveAdsMerchantAccess({
    request,
    supabase: auth.supabase,
    userId: auth.user.id,
  });
  if (merchant.response) return merchant.response;
  const access = merchant.access;
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
  const parsed = metaAdsSyncRequestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  try {
    const result = await syncMetaAdsSpendForMerchant({
      ...parsed.data,
      merchantId: access.merchantId,
      supabase: auth.supabase,
    });
    return NextResponse.json({ ...result, synced: true });
  } catch (error) {
    if (error instanceof MetaAdsConfigError)
      return NextResponse.json(
        { error: 'Meta Ads integration unavailable' },
        { status: 503 }
      );
    if (error instanceof MetaAdsSyncError)
      return NextResponse.json(
        { error: error.code },
        { status: error.code === 'META_ADS_ACCOUNT_NOT_SELECTED' ? 409 : 502 }
      );
    if (error instanceof MetaAdsProviderError)
      return NextResponse.json({ error: error.code }, { status: 502 });
    return NextResponse.json(
      { error: 'Meta Ads sync failed' },
      { status: 502 }
    );
  }
}
