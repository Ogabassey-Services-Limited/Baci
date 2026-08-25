import type { SupabaseClient } from '@supabase/supabase-js';
import { JumiaApiError } from '@/lib/jumia/helpers';
import { loadJumiaAuthorizationGrant } from '@/lib/jumia/load-jumia-authorization-grant';
import { logger } from '@/lib/logger';
import type { JumiaSelfAuthorizationTokenResponse } from '@/schemas/jumia';
import {
  type JumiaAuthorizationRefreshState,
  reloadSharedAuthorizationCredentials,
} from './jumia-authorization-refresh-lease';
import type { JumiaClientTokenPersistenceState } from './jumia-client-token-persistence';

const JUMIA_ROTATION_PERSIST_ATTEMPTS = 3;

async function encryptRotatedCredentials(
  state: JumiaClientTokenPersistenceState,
  refreshToken: string,
  accessToken: string,
  clientKeyHash: string
): Promise<string> {
  const { getJumiaAuthorizationEncryptionKey } = await import('@/env');
  const { jumiaAuthorizationCrypto } = await import(
    '@/lib/jumia/authorization-crypto'
  );
  const key = getJumiaAuthorizationEncryptionKey();
  if (!key) {
    throw new JumiaApiError(
      500,
      'Jumia authorization encryption is not configured'
    );
  }
  return jumiaAuthorizationCrypto.encrypt(
    { clientId: state.clientId, refreshToken, accessToken },
    key,
    jumiaAuthorizationCrypto.buildAuthorizationContext(
      state.merchantId,
      clientKeyHash
    )
  );
}

export async function persistJumiaAuthorizationRotation(args: {
  state: JumiaClientTokenPersistenceState;
  supabase: SupabaseClient;
  refreshLeaseToken: string;
  data: JumiaSelfAuthorizationTokenResponse;
  tokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}): Promise<Partial<JumiaClientTokenPersistenceState>> {
  const { state, supabase, refreshLeaseToken, data } = args;
  const authorizationId = state.authorizationId;
  if (!authorizationId) {
    throw new JumiaApiError(500, 'Shared Jumia authorization id is required');
  }

  const authorizationGrant = await loadJumiaAuthorizationGrant(
    supabase,
    authorizationId,
    state.merchantId
  );
  const ciphertext = await encryptRotatedCredentials(
    state,
    data.refresh_token,
    data.access_token,
    authorizationGrant.client_key_hash
  );

  const rotationRpcArgs = {
    p_authorization_id: authorizationId,
    p_credential_ciphertext: ciphertext,
    p_token_expires_at: args.tokenExpiresAt.toISOString(),
    p_refresh_token_expires_at: args.refreshTokenExpiresAt.toISOString(),
    p_expected_rotation_version: state.authorizationRotationVersion ?? 1,
    p_refresh_lease_token: refreshLeaseToken,
  };

  let rotationVersion: unknown;
  let updateError: { code?: string; message?: string } | null = null;
  for (
    let attempt = 1;
    attempt <= JUMIA_ROTATION_PERSIST_ATTEMPTS;
    attempt += 1
  ) {
    const result = await supabase.rpc(
      'rotate_jumia_authorization_credentials',
      rotationRpcArgs
    );
    rotationVersion = result.data;
    updateError = result.error;
    if (!updateError) {
      break;
    }

    const isStaleRotation =
      updateError.code === '40001' ||
      updateError.message?.includes('Stale Jumia authorization rotation');
    if (isStaleRotation) {
      const refreshState: JumiaAuthorizationRefreshState = {
        integrationId: state.integrationId,
        merchantId: state.merchantId,
        authorizationId,
        authorizationRotationVersion: state.authorizationRotationVersion,
        tokenExpiresAt: state.tokenExpiresAt,
        refreshTokenExpiresAt: state.refreshTokenExpiresAt,
      };
      return reloadSharedAuthorizationCredentials(refreshState, supabase);
    }

    if (attempt === JUMIA_ROTATION_PERSIST_ATTEMPTS) {
      break;
    }
  }

  if (updateError) {
    logger.error({
      message:
        'Failed to persist rotated Jumia credentials; retaining the provider-issued pair in the active client',
      error: updateError,
      integration_id: state.integrationId,
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: args.tokenExpiresAt,
      refreshTokenExpiresAt: args.refreshTokenExpiresAt,
      authorizationRotationVersion: state.authorizationRotationVersion,
    };
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: args.tokenExpiresAt,
    refreshTokenExpiresAt: args.refreshTokenExpiresAt,
    authorizationRotationVersion:
      typeof rotationVersion === 'number'
        ? rotationVersion
        : state.authorizationRotationVersion,
  };
}
