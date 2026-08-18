import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadJumiaAuthorizationGrant } from '@/lib/jumia/load-jumia-authorization-grant';

vi.mock('@/env', () => ({
  getJumiaAuthorizationEncryptionKey: () => 'test-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getSupabaseUrl: () => 'https://example.supabase.co',
}));

vi.mock('@/lib/jumia/authorization-crypto', () => ({
  jumiaAuthorizationCrypto: {
    buildAuthorizationContext: (merchantId: string, clientKeyHash: string) =>
      `${merchantId}:${clientKeyHash}`,
    decrypt: vi.fn().mockReturnValue({
      accessToken: 'fresh-access',
      refreshToken: 'fresh-refresh',
      clientId: 'client-id',
    }),
  },
}));

vi.mock('@/lib/jumia/load-jumia-authorization-grant', () => ({
  loadJumiaAuthorizationGrant: vi.fn(),
}));

import {
  acquireJumiaAuthorizationRefreshLease,
  REFRESH_LEASE_BUSY_RETRIES,
} from './jumia-authorization-refresh-lease';

describe('acquireJumiaAuthorizationRefreshLease', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadJumiaAuthorizationGrant).mockResolvedValue({
      credential_ciphertext: 'stored-ciphertext',
      token_expires_at: '2026-12-31T10:00:00.000Z',
      refresh_token_expires_at: '2026-12-31T10:00:00.000Z',
      rotation_version: 2,
      client_key_hash: 'a'.repeat(64),
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns reloaded credentials when another refresh finishes while lease is busy', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '55P03', message: 'refresh already in progress' },
    });
    const supabase = { rpc };

    const result = await acquireJumiaAuthorizationRefreshLease(
      {
        integrationId: 'integration-1',
        merchantId: 'merchant-1',
        authorizationId: 'auth-1',
        authorizationRotationVersion: 1,
        tokenExpiresAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      supabase as never
    );

    expect(result).toEqual({
      reloaded: expect.objectContaining({
        accessToken: 'fresh-access',
        authorizationRotationVersion: 2,
        refreshTokenExpiresAt: new Date('2026-12-31T10:00:00.000Z'),
      }),
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('throws 503 when the refresh lease stays busy without fresher credentials', async () => {
    vi.mocked(loadJumiaAuthorizationGrant).mockResolvedValue({
      credential_ciphertext: 'stored-ciphertext',
      token_expires_at: '2026-01-01T00:00:00.000Z',
      refresh_token_expires_at: '2026-01-01T00:00:00.000Z',
      rotation_version: 1,
      client_key_hash: 'a'.repeat(64),
    } as never);

    const setTimeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation((handler) => {
        if (typeof handler === 'function') {
          handler();
        }
        return 0 as never;
      });

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '55P03', message: 'refresh already in progress' },
    });
    const supabase = { rpc };

    await expect(
      acquireJumiaAuthorizationRefreshLease(
        {
          integrationId: 'integration-1',
          merchantId: 'merchant-1',
          authorizationId: 'auth-1',
          authorizationRotationVersion: 1,
          tokenExpiresAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        supabase as never
      )
    ).rejects.toMatchObject({
      status: 503,
    });

    expect(rpc).toHaveBeenCalledTimes(REFRESH_LEASE_BUSY_RETRIES);
    setTimeoutSpy.mockRestore();
  });
});
