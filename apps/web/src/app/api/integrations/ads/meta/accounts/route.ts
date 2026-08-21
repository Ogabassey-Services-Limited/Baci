import { type NextRequest, NextResponse } from 'next/server';
import { resolveMetaAdsAccessToken } from '@/lib/ads/meta/access-token';
import {
  getMetaAdsConfig,
  META_ADS_CONFIG_MISSING,
} from '@/lib/ads/meta/config';
import { META_ADS_PROVIDER } from '@/lib/ads/meta/constants';
import { listMetaAdsAccounts } from '@/lib/ads/meta/provider';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { metaAdsAccountSelectionSchema } from '@/schemas/meta-ads';

async function connectionForMerchant(
  supabase: Awaited<ReturnType<typeof authenticateApiRequest>>['supabase'],
  merchantId: string
) {
  if (!supabase) return null;
  const result = await supabase.rpc('get_merchant_ads_connection_secret', {
    p_merchant_id: merchantId,
    p_provider: META_ADS_PROVIDER,
  });
  return result.error
    ? { error: true as const }
    : { connection: result.data?.[0] ?? null };
}

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase)
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  const access = await getUserAccess(auth.supabase);
  if (!access)
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  if (!hasPermission(access, 'integrations', 'manage'))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  try {
    const config = getMetaAdsConfig();
    const result = await connectionForMerchant(
      auth.supabase,
      access.merchantId
    );
    if (!result || ('error' in result && result.error))
      return NextResponse.json(
        { error: 'Failed to read Meta Ads connection' },
        { status: 500 }
      );
    if (result.connection?.status !== 'active')
      return NextResponse.json({ accounts: [], connected: false });
    const accounts = await listMetaAdsAccounts(
      resolveMetaAdsAccessToken(result.connection, config)
    );
    return NextResponse.json({
      accounts: accounts.map(
        ({ accountId, currencyCode, label, timezoneName }) => ({
          accountId,
          currencyCode,
          label,
          selected: accountId === result.connection?.provider_customer_id,
          timezoneName,
        })
      ),
      connected: true,
    });
  } catch {
    return NextResponse.json(
      { error: META_ADS_CONFIG_MISSING },
      { status: 502 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
  const parsed = metaAdsAccountSelectionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  try {
    const result = await connectionForMerchant(
      auth.supabase,
      access.merchantId
    );
    if (!result || ('error' in result && result.error))
      return NextResponse.json(
        { error: 'Failed to read Meta Ads connection' },
        { status: 500 }
      );
    if (!result.connection)
      return NextResponse.json(
        { error: 'Meta Ads is not connected' },
        { status: 404 }
      );
    const accounts = await listMetaAdsAccounts(
      resolveMetaAdsAccessToken(result.connection, getMetaAdsConfig())
    );
    const account = accounts.find(
      (candidate) => candidate.accountId === parsed.data.accountId
    );
    if (!account)
      return NextResponse.json(
        { error: 'Meta Ads account is not accessible' },
        { status: 400 }
      );
    const { data, error } = await auth.supabase.rpc(
      'set_merchant_ads_account',
      {
        p_account_timezone: account.timezoneName,
        p_attribution_metadata: {
          currencyCode: account.currencyCode,
          providerTimezoneOffsetHours: account.timezoneOffsetHours,
        },
        p_merchant_id: access.merchantId,
        p_provider: META_ADS_PROVIDER,
        p_provider_account_label: account.label,
        p_provider_customer_id: account.accountId,
      }
    );
    if (error || data !== true)
      return NextResponse.json(
        { error: 'Failed to select Meta Ads account' },
        { status: 500 }
      );
    return NextResponse.json({ accountId: account.accountId, selected: true });
  } catch {
    return NextResponse.json(
      { error: 'Meta Ads authorization expired' },
      { status: 502 }
    );
  }
}
