import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireJumiaAuthorizationRefreshLease } from '@/lib/jumia/jumia-authorization-refresh-lease';
import { loadJumiaAuthorizationGrant } from '@/lib/jumia/load-jumia-authorization-grant';
import {
  claimJumiaResumedAuthorization,
  type ResumedJumiaAuthorizationLease,
} from './claim-jumia-resumed-authorization';

vi.mock('@/lib/jumia/jumia-authorization-refresh-lease', () => ({
  acquireJumiaAuthorizationRefreshLease: vi.fn(),
}));
vi.mock('@/lib/jumia/load-jumia-authorization-grant', () => ({
  loadJumiaAuthorizationGrant: vi.fn(),
}));
vi.mock('@/lib/jumia/authorization-crypto', () => ({
  jumiaAuthorizationCrypto: {
    decrypt: vi.fn(() => ({
      clientId: 'client-1',
      refreshToken: 'fresh-refresh',
      accessToken: 'fresh-access',
    })),
    buildAuthorizationContext: vi.fn(
      (merchantId: string, clientKeyHash: string) =>
        `${merchantId}:${clientKeyHash}`
    ),
  },
}));

function buildQuery(
  data: unknown,
  requiredEqCalls: number,
  error: unknown = null
) {
  const query = {
    eq: vi.fn(),
  };
  const rows = data == null ? [] : Array.isArray(data) ? data : [data];
  let eqCalls = 0;
  query.eq.mockImplementation(() => {
    eqCalls += 1;
    return eqCalls >= requiredEqCalls
      ? Promise.resolve({ data: rows, error })
      : query;
  });
  return query;
}

function buildSupabase(args: {
  authorization?: unknown;
  integration?: unknown;
  authorizationError?: unknown;
  integrationError?: unknown;
}) {
  const authorizationQuery = buildQuery(
    args.authorization ?? null,
    2,
    args.authorizationError
  );
  const integrationQuery = buildQuery(
    args.integration ?? null,
    3,
    args.integrationError
  );
  return {
    from: vi.fn((table: string) =>
      table === 'jumia_authorizations'
        ? {
            select: vi.fn(() => authorizationQuery),
          }
        : {
            select: vi.fn(() => integrationQuery),
          }
    ),
    rpc: vi.fn(),
  } as never;
}

describe('claimJumiaResumedAuthorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(acquireJumiaAuthorizationRefreshLease).mockResolvedValue({
      leaseToken: 'lease-1',
    });
    vi.mocked(loadJumiaAuthorizationGrant).mockResolvedValue({
      credential_ciphertext: 'ciphertext',
      token_expires_at: '2026-08-31T12:00:00.000Z',
      refresh_token_expires_at: '2026-09-30T12:00:00.000Z',
      rotation_version: 2,
      client_key_hash: 'hash-1',
    });
  });

  it('returns null when no active self-authorization grant matches', async () => {
    const result = await claimJumiaResumedAuthorization({
      clientKeyHash: 'hash-1',
      encryptionKey: 'key',
      merchantId: 'merchant-1',
      supabase: buildSupabase({}),
    });

    expect(result).toBeNull();
    expect(acquireJumiaAuthorizationRefreshLease).not.toHaveBeenCalled();
  });

  it('returns null when the authorization row is missing', async () => {
    const result = await claimJumiaResumedAuthorization({
      clientKeyHash: 'hash-1',
      encryptionKey: 'key',
      merchantId: 'merchant-1',
      supabase: buildSupabase({ authorization: null }),
    });

    expect(result).toBeNull();
    expect(acquireJumiaAuthorizationRefreshLease).not.toHaveBeenCalled();
  });

  it('claims the shared refresh lease before loading credentials', async () => {
    const events: string[] = [];
    vi.mocked(acquireJumiaAuthorizationRefreshLease).mockImplementationOnce(
      async () => {
        events.push('claim');
        return { leaseToken: 'lease-1' };
      }
    );
    vi.mocked(loadJumiaAuthorizationGrant).mockImplementationOnce(async () => {
      events.push('load');
      return {
        credential_ciphertext: 'ciphertext',
        token_expires_at: '2026-08-31T12:00:00.000Z',
        refresh_token_expires_at: '2026-09-30T12:00:00.000Z',
        rotation_version: 2,
        client_key_hash: 'hash-1',
      };
    });

    const result = await claimJumiaResumedAuthorization({
      clientKeyHash: 'hash-1',
      encryptionKey: 'key',
      merchantId: 'merchant-1',
      supabase: buildSupabase({
        authorization: {
          id: 'auth-1',
          token_expires_at: '2026-08-31T12:00:00.000Z',
          refresh_token_expires_at: '2026-09-30T12:00:00.000Z',
          rotation_version: 1,
        },
        integration: {
          id: 'integration-1',
          connection_method: 'self_authorization',
          jumia_authorization_id: 'auth-1',
        },
      }),
    });

    expect(events).toEqual(['claim', 'load']);
    expect(result).toEqual<ResumedJumiaAuthorizationLease>({
      credentials: { clientId: 'client-1', refreshToken: 'fresh-refresh' },
      authorizationId: 'auth-1',
      authorizationRotationVersion: 1,
      leaseToken: 'lease-1',
    });
  });

  it('retries with reloaded state when another refresh wins the lease', async () => {
    vi.mocked(acquireJumiaAuthorizationRefreshLease)
      .mockResolvedValueOnce({
        reloaded: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          clientId: 'client-1',
          tokenExpiresAt: new Date('2026-08-31T13:00:00.000Z'),
          authorizationRotationVersion: 2,
          refreshTokenExpiresAt: new Date('2026-09-30T13:00:00.000Z'),
        },
      })
      .mockResolvedValueOnce({ leaseToken: 'lease-2' });

    const result = await claimJumiaResumedAuthorization({
      clientKeyHash: 'hash-1',
      encryptionKey: 'key',
      merchantId: 'merchant-1',
      supabase: buildSupabase({
        authorization: {
          id: 'auth-1',
          token_expires_at: '2026-08-31T12:00:00.000Z',
          refresh_token_expires_at: '2026-09-30T12:00:00.000Z',
          rotation_version: 1,
        },
        integration: {
          id: 'integration-1',
          connection_method: 'self_authorization',
          jumia_authorization_id: 'auth-1',
        },
      }),
    });

    expect(result?.authorizationRotationVersion).toBe(2);
    expect(acquireJumiaAuthorizationRefreshLease).toHaveBeenCalledTimes(2);
  });
});
