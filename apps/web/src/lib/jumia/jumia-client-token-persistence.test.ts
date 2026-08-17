import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JumiaApiError } from '@/lib/jumia/helpers';

const encrypt = vi.fn();
const decrypt = vi.fn();
const adminRpc = vi.fn();

vi.mock('@/env', () => ({
  getJumiaAuthorizationEncryptionKey: () => 'test-key',
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: (...args: unknown[]) => adminRpc(...args),
  }),
}));

vi.mock('@/lib/jumia/authorization-crypto', () => ({
  jumiaAuthorizationCrypto: {
    buildAuthorizationContext: (merchantId: string, clientKeyHash: string) =>
      `${merchantId}:${clientKeyHash}`,
    encrypt: (...args: unknown[]) => encrypt(...args),
    decrypt: (...args: unknown[]) => decrypt(...args),
  },
}));

vi.mock('@/lib/jumia/load-jumia-authorization-grant', () => ({
  loadJumiaAuthorizationGrant: vi.fn().mockResolvedValue({
    credential_ciphertext: 'stored-ciphertext',
    token_expires_at: '2026-03-27T10:00:00.000Z',
    rotation_version: 1,
    client_key_hash: 'a'.repeat(64),
  }),
}));

import { refreshJumiaClientAccessToken } from './jumia-client-token-persistence';

describe('refreshJumiaClientAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    encrypt.mockReturnValue('encrypted-ciphertext');
    adminRpc.mockReset();
  });

  it('throws when refresh token is missing', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const supabase = {
      from: vi.fn().mockReturnValue({ update }),
    };

    await expect(
      refreshJumiaClientAccessToken(
        {
          integrationId: 'integration-1',
          merchantId: 'merchant-1',
          accessToken: 'access',
          refreshToken: '   ',
          clientId: 'client-id',
          tokenExpiresAt: null,
          supabase: supabase as never,
          apiBase: 'https://api.jumia.test',
        },
        vi.fn()
      )
    ).rejects.toBeInstanceOf(JumiaApiError);
  });

  it('encrypts the refreshed access token into rotated credentials', async () => {
    adminRpc
      .mockResolvedValueOnce({
        data: 'lease-token',
        error: null,
      })
      .mockResolvedValueOnce({
        data: 2,
        error: null,
      });
    const supabase = {
      rpc: vi.fn(),
    };
    const fetchWithThrottle = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'fresh-access-token',
          refresh_token: 'fresh-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
        { status: 200 }
      )
    );

    const result = await refreshJumiaClientAccessToken(
      {
        integrationId: 'integration-1',
        merchantId: 'merchant-1',
        accessToken: 'stale-access',
        refreshToken: 'refresh-token',
        clientId: 'client-id',
        authorizationId: 'auth-1',
        authorizationRotationVersion: 1,
        tokenExpiresAt: null,
        supabase: supabase as never,
        apiBase: 'https://api.jumia.test',
      },
      fetchWithThrottle
    );

    expect(result.accessToken).toBe('fresh-access-token');
    expect(encrypt).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'fresh-access-token',
        refreshToken: 'fresh-refresh-token',
      }),
      'test-key',
      `merchant-1:${'a'.repeat(64)}`
    );
    expect(adminRpc).toHaveBeenNthCalledWith(
      1,
      'claim_jumia_authorization_refresh_lease',
      expect.objectContaining({
        p_authorization_id: 'auth-1',
        p_expected_rotation_version: 1,
      })
    );
    expect(adminRpc).toHaveBeenNthCalledWith(
      2,
      'rotate_jumia_authorization_credentials',
      expect.objectContaining({
        p_credential_ciphertext: 'encrypted-ciphertext',
        p_refresh_lease_token: 'lease-token',
      })
    );
  });

  it('reuses an in-flight refresh for the same authorization grant', async () => {
    adminRpc.mockImplementation(async (name: string) => {
      if (name === 'claim_jumia_authorization_refresh_lease') {
        return { data: 'lease-token', error: null };
      }
      return { data: 2, error: null };
    });
    const supabase = { rpc: vi.fn() };
    let releaseFetch: (() => void) | undefined;
    const fetchGate = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const fetchWithThrottle = vi.fn().mockImplementation(async () => {
      await fetchGate;
      return new Response(
        JSON.stringify({
          access_token: 'fresh-access-token',
          refresh_token: 'fresh-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
        { status: 200 }
      );
    });
    const state = {
      integrationId: 'integration-1',
      merchantId: 'merchant-1',
      accessToken: 'stale-access',
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      authorizationId: 'auth-1',
      authorizationRotationVersion: 1,
      tokenExpiresAt: null,
      supabase: supabase as never,
      apiBase: 'https://api.jumia.test',
    };

    const firstRefresh = refreshJumiaClientAccessToken(
      state,
      fetchWithThrottle
    );
    const secondRefresh = refreshJumiaClientAccessToken(
      state,
      fetchWithThrottle
    );

    releaseFetch?.();
    const [firstResult, secondResult] = await Promise.all([
      firstRefresh,
      secondRefresh,
    ]);

    expect(firstResult.accessToken).toBe('fresh-access-token');
    expect(secondResult.accessToken).toBe('fresh-access-token');
    expect(fetchWithThrottle).toHaveBeenCalledTimes(1);
  });
});
