import type { SupabaseClient } from '@supabase/supabase-js';
import { jumiaAuthorizationCrypto } from '@/lib/jumia/authorization-crypto';
import {
  acquireJumiaAuthorizationRefreshLease,
  type JumiaAuthorizationRefreshState,
} from '@/lib/jumia/jumia-authorization-refresh-lease';
import { loadJumiaAuthorizationGrant } from '@/lib/jumia/load-jumia-authorization-grant';
import type { JumiaSelfAuthorizationCredentials } from '@/schemas/jumia/self-authorization';

type AuthorizationRow = {
  id: string;
  token_expires_at: string;
  refresh_token_expires_at: string;
  rotation_version: number;
};

type IntegrationRow = { id: string };

export type ResumedJumiaAuthorizationLease = {
  credentials: JumiaSelfAuthorizationCredentials;
  authorizationId: string;
  authorizationRotationVersion: number;
  leaseToken: string;
};

export async function claimJumiaResumedAuthorization(args: {
  clientKeyHash: string;
  encryptionKey: string;
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<ResumedJumiaAuthorizationLease | null> {
  const { data: authorizationRows, error: authorizationError } =
    await args.supabase
      .from('jumia_authorizations')
      .select(
        'id, token_expires_at, refresh_token_expires_at, rotation_version'
      )
      .eq('merchant_id', args.merchantId)
      .eq('client_key_hash', args.clientKeyHash);

  if (authorizationError) {
    throw new Error('Failed to load existing Jumia authorization');
  }

  const authorization =
    (authorizationRows as AuthorizationRow[] | null)?.[0] ?? null;
  if (!authorization) return null;

  const authorizationRow = authorization as AuthorizationRow;
  const { data: integrationRows, error: integrationError } = await args.supabase
    .from('marketplace_integrations')
    .select('id, connection_method, jumia_authorization_id')
    .eq('merchant_id', args.merchantId)
    .eq('platform', 'jumia')
    .eq('is_active', true);

  if (integrationError) {
    throw new Error('Failed to load existing Jumia authorization');
  }

  const integration = (
    (integrationRows as Array<
      IntegrationRow & {
        connection_method?: string;
        jumia_authorization_id?: string | null;
      }
    > | null) ?? []
  ).find(
    (row) =>
      row.connection_method === 'self_authorization' &&
      row.jumia_authorization_id === authorizationRow.id
  );

  if (!integration) return null;

  const integrationRow = integration as IntegrationRow;
  let state: JumiaAuthorizationRefreshState = {
    integrationId: integrationRow.id,
    merchantId: args.merchantId,
    authorizationId: authorizationRow.id,
    authorizationRotationVersion: authorizationRow.rotation_version,
    tokenExpiresAt: new Date(authorizationRow.token_expires_at),
    refreshTokenExpiresAt: new Date(authorizationRow.refresh_token_expires_at),
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const lease = await acquireJumiaAuthorizationRefreshLease(
      state,
      args.supabase
    );
    if ('reloaded' in lease) {
      state = {
        ...state,
        authorizationRotationVersion:
          lease.reloaded.authorizationRotationVersion,
        tokenExpiresAt: lease.reloaded.tokenExpiresAt,
        refreshTokenExpiresAt: lease.reloaded.refreshTokenExpiresAt,
      };
      continue;
    }

    const currentAuthorization = await loadJumiaAuthorizationGrant(
      args.supabase,
      state.authorizationId,
      args.merchantId
    );
    const decrypted = jumiaAuthorizationCrypto.decrypt(
      currentAuthorization.credential_ciphertext,
      args.encryptionKey,
      jumiaAuthorizationCrypto.buildAuthorizationContext(
        args.merchantId,
        currentAuthorization.client_key_hash
      )
    );

    return {
      credentials: {
        clientId: decrypted.clientId,
        refreshToken: decrypted.refreshToken,
      },
      authorizationId: state.authorizationId,
      authorizationRotationVersion: state.authorizationRotationVersion ?? 1,
      leaseToken: lease.leaseToken,
    };
  }

  throw new Error('Jumia authorization refresh is still in progress');
}
