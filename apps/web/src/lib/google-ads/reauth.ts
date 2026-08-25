import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export function getGoogleAdsReauthReason(error: unknown): string | null {
  const record =
    error !== null && typeof error === 'object'
      ? (error as { code?: unknown; status?: unknown })
      : null;
  const code =
    record && typeof record.code === 'string'
      ? record.code
      : error instanceof Error
        ? error.message
        : null;
  const status = record?.status;
  return code === 'GOOGLE_ADS_ACCESS_TOKEN_REFRESH_FAILED' &&
    (status === undefined || status === null || status === 400)
    ? code
    : null;
}

export async function persistGoogleAdsReauthRequired(input: {
  connection: {
    access_token_ciphertext: string | null;
    refresh_token_ciphertext: string | null;
  };
  merchantId: string;
  supabase: SupabaseClient;
  reason: string;
}): Promise<boolean> {
  if (!input.connection.refresh_token_ciphertext) return true;
  const { data, error } = await input.supabase.rpc(
    'mark_google_ads_connection_reauth_if_current',
    {
      p_access_token_ciphertext: input.connection.access_token_ciphertext,
      p_merchant_id: input.merchantId,
      p_reason: input.reason,
      p_refresh_token_ciphertext: input.connection.refresh_token_ciphertext,
    }
  );
  return !error && data === true;
}
