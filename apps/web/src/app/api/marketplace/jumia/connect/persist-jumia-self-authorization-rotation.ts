import type { SupabaseClient } from '@supabase/supabase-js';

export async function persistJumiaSelfAuthorizationRotation(args: {
  supabase: SupabaseClient;
  merchantId: string;
  clientKeyHash: string;
  credentialCiphertext: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}): Promise<number | undefined> {
  const { data: authorizations, error: authorizationError } =
    await args.supabase
      .from('jumia_authorizations')
      .select('id, rotation_version')
      .eq('merchant_id', args.merchantId)
      .eq('client_key_hash', args.clientKeyHash);
  if (authorizationError) {
    throw new Error('Failed to load existing Jumia authorization scope');
  }

  const matchingAuthorizationIds = new Set(
    (authorizations ?? [])
      .map((authorization) => {
        if (
          typeof authorization !== 'object' ||
          authorization === null ||
          !('id' in authorization)
        ) {
          return undefined;
        }
        return authorization.id;
      })
      .filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0
      )
  );
  if (matchingAuthorizationIds.size !== 1) return undefined;
  const authorization = (authorizations ?? []).find(
    (row): row is { id: string; rotation_version: number } =>
      typeof row === 'object' &&
      row !== null &&
      'id' in row &&
      typeof row.id === 'string' &&
      matchingAuthorizationIds.has(row.id) &&
      'rotation_version' in row &&
      typeof row.rotation_version === 'number'
  );
  if (!authorization) return undefined;
  const authorizationId = authorization.id;

  const { data, error } = await args.supabase
    .from('marketplace_integrations')
    .select(
      'shop_id, country_code, marketplace_key, connection_method, jumia_authorization_id'
    )
    .eq('merchant_id', args.merchantId)
    .eq('platform', 'jumia')
    .eq('is_active', true);
  if (error) {
    throw new Error('Failed to load existing Jumia authorization scope');
  }

  const existingSelfAuthorizations = (data ?? []).filter(
    (row) =>
      row.jumia_authorization_id === authorizationId &&
      row.connection_method === 'self_authorization' &&
      typeof row.shop_id === 'string' &&
      row.shop_id.trim() &&
      typeof row.marketplace_key === 'string' &&
      row.marketplace_key.trim()
  );
  if (existingSelfAuthorizations.length === 0) return undefined;

  const { error: rotationError } = await args.supabase.rpc(
    'persist_jumia_self_authorization_ordered',
    {
      p_merchant_id: args.merchantId,
      p_client_key_hash: args.clientKeyHash,
      p_credential_ciphertext: args.credentialCiphertext,
      p_token_expires_at: args.accessTokenExpiresAt,
      p_refresh_token_expires_at: args.refreshTokenExpiresAt,
      p_shop_ids: existingSelfAuthorizations.map((row) => row.shop_id.trim()),
      p_shop_names: existingSelfAuthorizations.map((row) => row.shop_id.trim()),
      p_country_codes: existingSelfAuthorizations.map(
        (row) => row.country_code?.trim() || 'NG'
      ),
      p_marketplace_labels: existingSelfAuthorizations.map((row) =>
        row.marketplace_key.trim()
      ),
      p_business_client_codes: existingSelfAuthorizations.map((row) =>
        row.marketplace_key.trim()
      ),
      p_expected_rotation_version: authorization.rotation_version,
    }
  );
  if (rotationError) {
    throw new Error('Failed to persist rotated Jumia authorization');
  }
  return authorization.rotation_version;
}
