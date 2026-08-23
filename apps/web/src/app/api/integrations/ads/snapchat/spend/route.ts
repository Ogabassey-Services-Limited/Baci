import { type NextRequest, NextResponse } from 'next/server';
import { resolveAdsMerchantAccess } from '@/lib/ads/merchant-context';
import { SNAPCHAT_ADS_PROVIDER } from '@/lib/ads/snapchat/constants';
import { snapchatAdsLocalDate } from '@/lib/ads/snapchat/provider';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { snapchatAdsSpendQuerySchema } from '@/schemas/snapchat-ads';

const SELECT =
  'provider_customer_id, spend_date, currency_code, spend_amount_decimal, spend_micros, impressions, clicks, conversions, account_timezone, attribution_metadata, fetched_at' as const;
function dates(timezone: string, now = new Date()) {
  const endDate = snapchatAdsLocalDate(now.getTime(), timezone);
  const start = new Date(`${endDate}T00:00:00.000Z`);
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
  const connection = await auth.supabase
    .from('merchant_ad_connections')
    .select('account_timezone')
    .eq('merchant_id', access.merchantId)
    .eq('provider', SNAPCHAT_ADS_PROVIDER)
    .maybeSingle();
  if (connection.error)
    return NextResponse.json(
      { error: 'Failed to read Snapchat Ads connection status' },
      { status: 500 }
    );
  const defaults = dates(connection.data?.account_timezone ?? 'UTC');
  const parsed = snapchatAdsSpendQuerySchema.safeParse({
    accountId: request.nextUrl.searchParams.get('accountId') ?? undefined,
    endDate: request.nextUrl.searchParams.get('endDate') ?? defaults.endDate,
    startDate:
      request.nextUrl.searchParams.get('startDate') ?? defaults.startDate,
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  let query = auth.supabase
    .from('merchant_ad_spend_daily')
    .select(SELECT)
    .eq('merchant_id', access.merchantId)
    .eq('provider', SNAPCHAT_ADS_PROVIDER)
    .gte('spend_date', parsed.data.startDate ?? defaults.startDate)
    .lte('spend_date', parsed.data.endDate ?? defaults.endDate)
    .order('spend_date', { ascending: true });
  if (parsed.data.accountId)
    query = query.eq('provider_customer_id', parsed.data.accountId);
  const { data, error } = await query;
  if (error)
    return NextResponse.json(
      { error: 'Failed to read Snapchat Ads spend' },
      { status: 500 }
    );
  const rows = (data ?? []).map((row) => ({
    accountId: row.provider_customer_id,
    accountTimezone: row.account_timezone,
    attribution: row.attribution_metadata,
    clicks: row.clicks,
    clicksLabel: 'Swipe Ups',
    conversions: row.conversions,
    conversionsLabel: 'Snapchat-attributed purchases',
    currencyCode: row.currency_code,
    date: row.spend_date,
    fetchedAt: row.fetched_at,
    impressions: row.impressions,
    spendAmountDecimal: row.spend_amount_decimal,
    spendMicros: row.spend_micros,
  }));
  return NextResponse.json({
    currencyCode: rows[0]?.currencyCode ?? null,
    endDate: parsed.data.endDate ?? defaults.endDate,
    provider: SNAPCHAT_ADS_PROVIDER,
    rows,
    startDate: parsed.data.startDate ?? defaults.startDate,
  });
}
