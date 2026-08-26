import { type NextRequest, NextResponse } from 'next/server';
import { resolveAdsMerchantAccess } from '@/lib/ads/merchant-context';
import { TIKTOK_ADS_PROVIDER } from '@/lib/ads/tiktok/constants';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { tiktokAdsSpendQuerySchema } from '@/schemas/tiktok-ads';

const SELECT =
  'provider_customer_id, spend_date, currency_code, spend_amount_decimal, impressions, clicks, conversions, reach, account_timezone, attribution_metadata, fetched_at' as const;
function dates(now = new Date()) {
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 30);
  return { endDate, startDate: start.toISOString().slice(0, 10) };
}
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase)
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  const parsed = tiktokAdsSpendQuerySchema.safeParse({
    accountId: request.nextUrl.searchParams.get('accountId') ?? undefined,
    endDate: request.nextUrl.searchParams.get('endDate') ?? undefined,
    startDate: request.nextUrl.searchParams.get('startDate') ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
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
  if (!hasPermission(access, 'analytics', 'view'))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  const defaults = dates();
  let accountId = parsed.data.accountId;
  if (!accountId) {
    const { data: connection, error: connectionError } = await auth.supabase
      .from('merchant_ad_connections')
      .select('provider_customer_id')
      .eq('merchant_id', access.merchantId)
      .eq('provider', TIKTOK_ADS_PROVIDER)
      .eq('status', 'active')
      .maybeSingle();
    if (connectionError)
      return NextResponse.json(
        { error: 'Failed to read TikTok Ads connection status' },
        { status: 500 }
      );
    accountId = connection?.provider_customer_id ?? undefined;
  }
  if (!accountId)
    return NextResponse.json({
      currencyCode: null,
      endDate: parsed.data.endDate ?? defaults.endDate,
      provider: TIKTOK_ADS_PROVIDER,
      rows: [],
      startDate: parsed.data.startDate ?? defaults.startDate,
    });
  const query = auth.supabase
    .from('merchant_ad_spend_daily')
    .select(SELECT)
    .eq('merchant_id', access.merchantId)
    .eq('provider', TIKTOK_ADS_PROVIDER)
    .gte('spend_date', parsed.data.startDate ?? defaults.startDate)
    .lte('spend_date', parsed.data.endDate ?? defaults.endDate)
    .eq('provider_customer_id', accountId)
    .order('spend_date', { ascending: true });
  const { data, error } = await query;
  if (error)
    return NextResponse.json(
      { error: 'Failed to read TikTok Ads spend' },
      { status: 500 }
    );
  const rows = (data ?? []).map((row) => ({
    accountId: row.provider_customer_id,
    accountTimezone: row.account_timezone,
    attribution: row.attribution_metadata,
    clicks: row.clicks,
    conversions: row.conversions,
    currencyCode: row.currency_code,
    date: row.spend_date,
    fetchedAt: row.fetched_at,
    impressions: row.impressions,
    reach: row.reach,
    spendAmountDecimal: row.spend_amount_decimal,
  }));
  return NextResponse.json({
    currencyCode: rows[0]?.currencyCode ?? null,
    endDate: parsed.data.endDate ?? defaults.endDate,
    provider: TIKTOK_ADS_PROVIDER,
    rows,
    startDate: parsed.data.startDate ?? defaults.startDate,
  });
}
