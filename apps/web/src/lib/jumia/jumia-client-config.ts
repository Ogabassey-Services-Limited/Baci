import type { SupabaseClient } from '@supabase/supabase-js';
import { JumiaApiError } from '@/lib/jumia/helpers';

const INTEGRATION_COLUMNS =
  'id, merchant_id, shop_id, access_token, refresh_token, token_expires_at' as const;

type JumiaIntegrationRow = {
  id: string;
  merchant_id: string;
  shop_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
};

export type JumiaClientConfig = {
  integrationId: string;
  merchantId: string;
  shopId: string;
  accessToken: string | null;
  refreshToken: string;
  tokenExpiresAt: Date | null;
  supabase: SupabaseClient;
};

function toJumiaClientConfig(
  row: JumiaIntegrationRow,
  supabase: SupabaseClient
): JumiaClientConfig {
  return {
    integrationId: row.id,
    merchantId: row.merchant_id,
    shopId: row.shop_id || 'oauth',
    accessToken: row.access_token,
    refreshToken: row.refresh_token || '',
    tokenExpiresAt: row.token_expires_at
      ? new Date(row.token_expires_at)
      : null,
    supabase,
  };
}

export async function loadJumiaIntegrationConfig(
  supabase: SupabaseClient,
  merchantId: string,
  integrationId: string
): Promise<JumiaClientConfig> {
  const { data, error } = await supabase
    .from('marketplace_integrations')
    .select(INTEGRATION_COLUMNS)
    .eq('id', integrationId)
    .eq('merchant_id', merchantId)
    .eq('platform', 'jumia')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new JumiaApiError(
      404,
      `Jumia integration not found: ${integrationId}`
    );
  }

  return toJumiaClientConfig(data as JumiaIntegrationRow, supabase);
}

export async function loadSingleJumiaMerchantIntegrationConfig(
  supabase: SupabaseClient,
  merchantId: string
): Promise<JumiaClientConfig> {
  const { data, error } = await supabase
    .from('marketplace_integrations')
    .select(INTEGRATION_COLUMNS)
    .eq('merchant_id', merchantId)
    .eq('platform', 'jumia')
    .eq('is_active', true)
    .limit(2);

  if (error || !data || data.length === 0) {
    throw new JumiaApiError(404, 'No active Jumia integration found');
  }

  if (data.length > 1) {
    throw new JumiaApiError(
      400,
      `Multiple active Jumia integrations found for merchant ${merchantId}. Use forIntegration() with a specific integrationId.`
    );
  }

  return toJumiaClientConfig(data[0] as JumiaIntegrationRow, supabase);
}
