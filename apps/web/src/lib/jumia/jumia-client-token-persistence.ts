import type { SupabaseClient } from '@supabase/supabase-js';
import { JumiaApiError } from '@/lib/jumia/helpers';
import { loadJumiaAuthorizationGrant } from '@/lib/jumia/load-jumia-authorization-grant';
import { createAdminClient } from '@/lib/supabase/admin';
import { JumiaTokenResponseSchema } from '@/schemas/jumia';
import {
  acquireJumiaAuthorizationRefreshLease,
  type JumiaAuthorizationRefreshState,
  reloadSharedAuthorizationCredentials,
} from './jumia-authorization-refresh-lease';

const REQUEST_TIMEOUT_MS = 30_000;
const MISSING_REFRESH_TOKEN_SYNC_ERROR =
  'Reconnect Jumia to resume syncing. Jumia did not return a refresh token for this OAuth connection.';

const refreshInFlight = new Map<
  string,
  Promise<Partial<JumiaClientTokenPersistenceState>>
>();

function getRefreshLockKey(state: JumiaClientTokenPersistenceState): string {
  return state.authorizationId ?? state.integrationId;
}

export type JumiaClientTokenPersistenceState = {
  integrationId: string;
  merchantId: string;
  accessToken: string | null;
  refreshToken: string;
  clientId: string;
  authorizationId?: string;
  authorizationRotationVersion?: number;
  tokenExpiresAt: Date | null;
  supabase: SupabaseClient | null;
  apiBase: string;
};

type FetchWithThrottle = (url: string, init: RequestInit) => Promise<Response>;

function getScopedSupabaseForPersistence(
  state: JumiaClientTokenPersistenceState
): SupabaseClient {
  if (state.supabase) {
    return state.supabase;
  }

  throw new JumiaApiError(
    500,
    'Scoped Supabase client is required to persist Jumia token state'
  );
}

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
    {
      clientId: state.clientId,
      refreshToken,
      accessToken,
    },
    key,
    jumiaAuthorizationCrypto.buildAuthorizationContext(
      state.merchantId,
      clientKeyHash
    )
  );
}

function toRefreshState(
  state: JumiaClientTokenPersistenceState
): JumiaAuthorizationRefreshState {
  if (!state.authorizationId) {
    throw new JumiaApiError(
      500,
      'Shared Jumia authorization id is required to refresh credentials'
    );
  }

  return {
    integrationId: state.integrationId,
    merchantId: state.merchantId,
    authorizationId: state.authorizationId,
    authorizationRotationVersion: state.authorizationRotationVersion,
    tokenExpiresAt: state.tokenExpiresAt,
  };
}

export function refreshJumiaClientAccessToken(
  state: JumiaClientTokenPersistenceState,
  fetchWithThrottle: FetchWithThrottle
): Promise<Partial<JumiaClientTokenPersistenceState>> {
  const lockKey = getRefreshLockKey(state);
  const inFlight = refreshInFlight.get(lockKey);
  if (inFlight) {
    return inFlight;
  }

  const refreshPromise = refreshJumiaClientAccessTokenOnce(
    state,
    fetchWithThrottle
  ).finally(() => {
    refreshInFlight.delete(lockKey);
  });
  refreshInFlight.set(lockKey, refreshPromise);
  return refreshPromise;
}

async function refreshJumiaClientAccessTokenOnce(
  state: JumiaClientTokenPersistenceState,
  fetchWithThrottle: FetchWithThrottle
): Promise<Partial<JumiaClientTokenPersistenceState>> {
  if (!state.refreshToken?.trim()) {
    const supabase = getScopedSupabaseForPersistence(state);
    const { error: updateError } = await supabase
      .from('marketplace_integrations')
      .update({ sync_error: MISSING_REFRESH_TOKEN_SYNC_ERROR })
      .eq('id', state.integrationId)
      .eq('merchant_id', state.merchantId);

    throw new JumiaApiError(
      401,
      MISSING_REFRESH_TOKEN_SYNC_ERROR,
      updateError ?? undefined
    );
  }

  const supabase = getScopedSupabaseForPersistence(state);
  let refreshLeaseToken: string | null = null;

  if (state.authorizationId) {
    const leaseResult = await acquireJumiaAuthorizationRefreshLease(
      toRefreshState(state),
      supabase
    );
    if ('reloaded' in leaseResult) {
      return leaseResult.reloaded;
    }
    refreshLeaseToken = leaseResult.leaseToken;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchWithThrottle(`${state.apiBase}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: state.refreshToken,
        client_id: state.clientId,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new JumiaApiError(
        response.status,
        'Token refresh failed',
        await response.text()
      );
    }

    const data = JumiaTokenResponseSchema.parse(await response.json());
    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    const refreshToken = data.refresh_token || state.refreshToken;

    if (state.authorizationId) {
      const authorizationGrant = await loadJumiaAuthorizationGrant(
        supabase,
        state.authorizationId,
        state.merchantId
      );
      const ciphertext = await encryptRotatedCredentials(
        state,
        refreshToken,
        data.access_token,
        authorizationGrant.client_key_hash
      );
      const { data: rotationVersion, error: updateError } =
        await createAdminClient().rpc(
          'rotate_jumia_authorization_credentials',
          {
            p_authorization_id: state.authorizationId,
            p_credential_ciphertext: ciphertext,
            p_token_expires_at: tokenExpiresAt.toISOString(),
            p_expected_rotation_version:
              state.authorizationRotationVersion ?? 1,
            p_refresh_lease_token: refreshLeaseToken,
          }
        );

      if (updateError) {
        const isStaleRotation =
          updateError.code === '40001' ||
          updateError.message?.includes('Stale Jumia authorization rotation');
        if (isStaleRotation) {
          return reloadSharedAuthorizationCredentials(
            toRefreshState(state),
            supabase
          );
        }
        throw new JumiaApiError(
          500,
          `Failed to persist refreshed token for integration ${state.integrationId}`,
          updateError
        );
      }

      return {
        accessToken: data.access_token,
        refreshToken,
        tokenExpiresAt,
        authorizationRotationVersion:
          typeof rotationVersion === 'number'
            ? rotationVersion
            : state.authorizationRotationVersion,
      };
    }

    const { error: updateError } = await supabase
      .from('marketplace_integrations')
      .update({
        access_token: data.access_token,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt.toISOString(),
      })
      .eq('id', state.integrationId)
      .eq('merchant_id', state.merchantId);

    if (updateError) {
      throw new JumiaApiError(
        500,
        `Failed to persist refreshed token for integration ${state.integrationId}`,
        updateError
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken,
      tokenExpiresAt,
    };
  } catch (error) {
    if (
      (error instanceof Error || error instanceof DOMException) &&
      error.name === 'AbortError'
    ) {
      throw new JumiaApiError(408, 'Token refresh request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
