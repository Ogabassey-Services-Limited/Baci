import { type NextRequest, NextResponse } from 'next/server';
import { resolveTikTokAdsAccessToken } from '@/lib/ads/tiktok/access-token';
import {
  getTikTokAdsConfig,
  TIKTOK_ADS_CONFIG_MISSING,
  TikTokAdsConfigError,
} from '@/lib/ads/tiktok/config';
import { TIKTOK_ADS_PROVIDER } from '@/lib/ads/tiktok/constants';
import {
  listTikTokAdsAccounts,
  TikTokAdsProviderError,
} from '@/lib/ads/tiktok/provider';
import {
  markTikTokAdsReauthRequired,
  TikTokAdsReauthPersistenceError,
} from '@/lib/ads/tiktok/sync';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { tiktokAdsAccountSelectionSchema } from '@/schemas/tiktok-ads';

async function connection(
  supabase: Awaited<ReturnType<typeof authenticateApiRequest>>['supabase'],
  merchantId: string
) {
  if (!supabase) return null;
  const result = await supabase.rpc('get_merchant_ads_connection_secret', {
    p_merchant_id: merchantId,
    p_provider: TIKTOK_ADS_PROVIDER,
  });
  return result.error
    ? { error: true as const }
    : { connection: result.data?.[0] ?? null };
}
async function handleRevocation(
  error: unknown,
  current: {
    access_token_ciphertext: string | null;
    provider_customer_id: string | null;
  } | null,
  merchantId: string,
  supabase: NonNullable<
    Awaited<ReturnType<typeof authenticateApiRequest>>['supabase']
  >
): Promise<NextResponse | null> {
  if (
    !current ||
    !(
      error instanceof TikTokAdsProviderError &&
      error.code === 'TIKTOK_ADS_ACCESS_REVOKED'
    )
  )
    return null;
  try {
    await markTikTokAdsReauthRequired({
      connection: current,
      failureCode: error.code,
      merchantId,
      supabase,
    });
    return null;
  } catch (persist) {
    return persist instanceof TikTokAdsReauthPersistenceError
      ? NextResponse.json({ error: persist.code }, { status: 502 })
      : null;
  }
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
  let current: {
    access_token_ciphertext: string | null;
    provider_customer_id: string | null;
  } | null = null;
  try {
    const config = getTikTokAdsConfig();
    const result = await connection(auth.supabase, access.merchantId);
    if (!result || ('error' in result && result.error))
      return NextResponse.json(
        { error: 'Failed to read TikTok Ads connection' },
        { status: 500 }
      );
    if (result.connection?.status !== 'active')
      return NextResponse.json({ accounts: [], connected: false });
    current = result.connection;
    const accounts = await listTikTokAdsAccounts({
      accessToken: resolveTikTokAdsAccessToken(result.connection, config),
      appId: config.appId,
      appSecret: config.appSecret,
    });
    return NextResponse.json({
      accounts: accounts.map((account) => ({
        accountId: account.accountId,
        currencyCode: account.currencyCode,
        label: account.label,
        selected: account.accountId === current?.provider_customer_id,
        timezoneName: account.timezoneName,
      })),
      connected: true,
    });
  } catch (error) {
    const revocation = await handleRevocation(
      error,
      current,
      access.merchantId,
      auth.supabase
    );
    if (revocation) return revocation;
    if (error instanceof TikTokAdsConfigError)
      return NextResponse.json(
        { error: TIKTOK_ADS_CONFIG_MISSING },
        { status: 503 }
      );
    return NextResponse.json(
      {
        error:
          error instanceof TikTokAdsProviderError
            ? error.code
            : 'TIKTOK_ADS_AUTHORIZATION_UNAVAILABLE',
      },
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
  const parsed = tiktokAdsAccountSelectionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  let current: {
    access_token_ciphertext: string | null;
    provider_customer_id: string | null;
  } | null = null;
  try {
    const result = await connection(auth.supabase, access.merchantId);
    if (!result || ('error' in result && result.error))
      return NextResponse.json(
        { error: 'Failed to read TikTok Ads connection' },
        { status: 500 }
      );
    if (!result.connection)
      return NextResponse.json(
        { error: 'TikTok Ads is not connected' },
        { status: 404 }
      );
    current = result.connection;
    const config = getTikTokAdsConfig();
    const account = (
      await listTikTokAdsAccounts({
        accessToken: resolveTikTokAdsAccessToken(result.connection, config),
        appId: config.appId,
        appSecret: config.appSecret,
      })
    ).find((item) => item.accountId === parsed.data.accountId);
    if (!account)
      return NextResponse.json(
        { error: 'TikTok Ads account is not accessible' },
        { status: 400 }
      );
    const { data, error } = await auth.supabase.rpc(
      'set_merchant_ads_account',
      {
        p_account_timezone: account.timezoneName,
        p_attribution_metadata: {
          currencyCode: account.currencyCode,
          providerVersion: 'v1.3',
        },
        p_merchant_id: access.merchantId,
        p_provider: TIKTOK_ADS_PROVIDER,
        p_provider_account_label: account.label,
        p_provider_customer_id: account.accountId,
      }
    );
    return error || data !== true
      ? NextResponse.json(
          { error: 'Failed to select TikTok Ads account' },
          { status: 500 }
        )
      : NextResponse.json({ accountId: account.accountId, selected: true });
  } catch (error) {
    const revocation = await handleRevocation(
      error,
      current,
      access.merchantId,
      auth.supabase
    );
    if (revocation) return revocation;
    if (error instanceof TikTokAdsConfigError)
      return NextResponse.json(
        { error: TIKTOK_ADS_CONFIG_MISSING },
        { status: 503 }
      );
    return NextResponse.json(
      {
        error:
          error instanceof TikTokAdsProviderError
            ? error.code
            : 'TIKTOK_ADS_AUTHORIZATION_UNAVAILABLE',
      },
      { status: 502 }
    );
  }
}
