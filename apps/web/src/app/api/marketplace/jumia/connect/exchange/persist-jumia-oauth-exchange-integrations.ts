import type { SupabaseClient } from '@supabase/supabase-js';
import { lockJumiaOAuthShops } from '@/lib/jumia/lock-jumia-oauth-shops';

const JUMIA_OAUTH_UPSERT_ATTEMPTS = 3;

type JumiaOAuthIntegrationRow = {
  merchant_id: string;
  platform: 'jumia';
  shop_id: string;
  marketplace_key: string;
  connection_method: 'oauth';
  shop_name: string;
  country_code: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  is_active: boolean;
  jumia_authorization_id: null;
  sync_config: Record<string, unknown>;
};

export async function persistJumiaOAuthExchangeIntegrations(args: {
  supabase: Pick<SupabaseClient, 'from' | 'rpc'>;
  integrationRows: JumiaOAuthIntegrationRow[];
}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  let lastError: unknown = null;
  const merchantId = args.integrationRows[0]?.merchant_id;
  if (
    merchantId &&
    !(await lockJumiaOAuthShops(
      args.supabase,
      merchantId,
      args.integrationRows.map((row) => row.shop_id)
    ))
  ) {
    return { ok: false, error: new Error('Failed to lock Jumia shops') };
  }

  for (let attempt = 1; attempt <= JUMIA_OAUTH_UPSERT_ATTEMPTS; attempt += 1) {
    const { error } = await args.supabase
      .from('marketplace_integrations')
      .upsert(args.integrationRows, {
        onConflict: 'merchant_id,platform,shop_id,marketplace_key',
      });

    if (!error) {
      return { ok: true };
    }

    lastError = error;
    if (attempt === JUMIA_OAUTH_UPSERT_ATTEMPTS) {
      break;
    }
  }

  return { ok: false, error: lastError };
}
