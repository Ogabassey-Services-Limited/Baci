import type { SupabaseClient } from '@supabase/supabase-js';
import { JumiaApiError } from '@/lib/jumia/helpers';
import { loadJumiaAuthorizationGrant } from '@/lib/jumia/load-jumia-authorization-grant';
import { createAdminClient } from '@/lib/supabase/admin';

export const REFRESH_LEASE_SECONDS = 45;
export const REFRESH_LEASE_BUSY_RETRIES = 10;
export const REFRESH_LEASE_BUSY_DELAY_MS = 500;

export type JumiaAuthorizationRefreshState = {
  integrationId: string;
  merchantId: string;
  authorizationId: string;
  authorizationRotationVersion?: number;
  tokenExpiresAt: Date | null;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function claimJumiaAuthorizationRefreshLease(
  state: JumiaAuthorizationRefreshState,
  _supabase: SupabaseClient
): Promise<
  | { status: 'claimed'; leaseToken: string }
  | { status: 'busy' }
  | { status: 'stale' }
> {
  const { data, error } = await createAdminClient().rpc(
    'claim_jumia_authorization_refresh_lease',
    {
      p_authorization_id: state.authorizationId,
      p_merchant_id: state.merchantId,
      p_expected_rotation_version: state.authorizationRotationVersion ?? 1,
      p_lease_seconds: REFRESH_LEASE_SECONDS,
    }
  );

  if (!error && typeof data === 'string') {
    return { status: 'claimed', leaseToken: data };
  }

  if (
    error?.code === '40001' ||
    error?.message?.includes('Stale Jumia authorization rotation')
  ) {
    return { status: 'stale' };
  }

  if (
    error?.code === '55P03' ||
    error?.message?.includes('refresh already in progress')
  ) {
    return { status: 'busy' };
  }

  throw new JumiaApiError(
    500,
    `Failed to claim Jumia refresh lease for integration ${state.integrationId}`,
    error ?? undefined
  );
}

export async function reloadSharedAuthorizationCredentials(
  state: JumiaAuthorizationRefreshState,
  supabase: SupabaseClient
): Promise<{
  accessToken: string;
  refreshToken: string;
  clientId: string;
  tokenExpiresAt: Date;
  authorizationRotationVersion: number;
}> {
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

  const authorization = await loadJumiaAuthorizationGrant(
    supabase,
    state.authorizationId,
    state.merchantId
  );

  const credentials = jumiaAuthorizationCrypto.decrypt(
    authorization.credential_ciphertext,
    key,
    jumiaAuthorizationCrypto.buildAuthorizationContext(
      state.merchantId,
      authorization.client_key_hash
    )
  );

  return {
    accessToken: credentials.accessToken,
    refreshToken: credentials.refreshToken,
    clientId: credentials.clientId,
    tokenExpiresAt: new Date(authorization.token_expires_at),
    authorizationRotationVersion: authorization.rotation_version,
  };
}

function hasFreshSharedCredentials(
  state: JumiaAuthorizationRefreshState,
  reloaded: {
    tokenExpiresAt: Date;
    authorizationRotationVersion: number;
  }
): boolean {
  const startVersion = state.authorizationRotationVersion ?? 1;
  if (reloaded.authorizationRotationVersion > startVersion) {
    return true;
  }

  return (
    reloaded.tokenExpiresAt.getTime() >
    Math.max(Date.now(), state.tokenExpiresAt?.getTime() ?? 0)
  );
}

export async function acquireJumiaAuthorizationRefreshLease(
  state: JumiaAuthorizationRefreshState,
  supabase: SupabaseClient
): Promise<
  | { leaseToken: string }
  | {
      reloaded: Awaited<
        ReturnType<typeof reloadSharedAuthorizationCredentials>
      >;
    }
> {
  let currentState = state;

  for (let attempt = 0; attempt < REFRESH_LEASE_BUSY_RETRIES; attempt += 1) {
    const claim = await claimJumiaAuthorizationRefreshLease(
      currentState,
      supabase
    );
    if (claim.status === 'claimed') {
      return { leaseToken: claim.leaseToken };
    }

    if (claim.status === 'stale') {
      const reloaded = await reloadSharedAuthorizationCredentials(
        currentState,
        supabase
      );
      if (hasFreshSharedCredentials(currentState, reloaded)) {
        return { reloaded };
      }
      currentState = {
        ...currentState,
        authorizationRotationVersion: reloaded.authorizationRotationVersion,
        tokenExpiresAt: reloaded.tokenExpiresAt,
      };
      continue;
    }

    const reloaded = await reloadSharedAuthorizationCredentials(
      currentState,
      supabase
    );
    if (hasFreshSharedCredentials(currentState, reloaded)) {
      return { reloaded };
    }

    if (attempt < REFRESH_LEASE_BUSY_RETRIES - 1) {
      await delay(REFRESH_LEASE_BUSY_DELAY_MS * (attempt + 1));
    }
  }

  throw new JumiaApiError(
    503,
    'Jumia credential refresh is still in progress. Retry shortly.'
  );
}
