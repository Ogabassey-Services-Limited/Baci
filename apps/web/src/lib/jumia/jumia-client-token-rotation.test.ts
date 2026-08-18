import { beforeEach, describe, expect, it, vi } from 'vitest';

const encrypt = vi.fn();
const loadGrant = vi.fn();
const rpc = vi.fn();

vi.mock('@/env', () => ({
  getJumiaAuthorizationEncryptionKey: () => 'test-key',
}));
vi.mock('@/lib/jumia/authorization-crypto', () => ({
  jumiaAuthorizationCrypto: {
    buildAuthorizationContext: (merchantId: string, clientKeyHash: string) =>
      `${merchantId}:${clientKeyHash}`,
    encrypt: (...args: unknown[]) => encrypt(...args),
  },
}));
vi.mock('@/lib/jumia/load-jumia-authorization-grant', () => ({
  loadJumiaAuthorizationGrant: (...args: unknown[]) => loadGrant(...args),
}));

import { persistJumiaAuthorizationRotation } from './jumia-client-token-rotation';

describe('persistJumiaAuthorizationRotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    encrypt.mockReturnValue('encrypted-ciphertext');
    loadGrant.mockResolvedValue({ client_key_hash: 'a'.repeat(64) });
    rpc.mockResolvedValue({ data: 2, error: null });
  });

  it('encrypts rotated credentials and persists both expiry values through scoped RPC', async () => {
    const result = await persistJumiaAuthorizationRotation({
      state: {
        integrationId: 'integration-1',
        merchantId: 'merchant-1',
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        clientId: 'client-id',
        authorizationId: 'auth-1',
        authorizationRotationVersion: 1,
        tokenExpiresAt: new Date('2026-08-18T10:00:00.000Z'),
        supabase: { rpc } as never,
        apiBase: 'https://api.jumia.test',
      },
      supabase: { rpc } as never,
      refreshLeaseToken: 'lease-token',
      data: {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        refresh_expires_in: 86400,
        token_type: 'Bearer',
      },
      tokenExpiresAt: new Date('2026-08-18T11:00:00.000Z'),
      refreshTokenExpiresAt: new Date('2026-08-19T10:00:00.000Z'),
    });

    expect(result).toMatchObject({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      authorizationRotationVersion: 2,
    });
    expect(encrypt).toHaveBeenCalledWith(
      {
        clientId: 'client-id',
        refreshToken: 'new-refresh',
        accessToken: 'new-access',
      },
      'test-key',
      `merchant-1:${'a'.repeat(64)}`
    );
    expect(rpc).toHaveBeenCalledWith(
      'rotate_jumia_authorization_credentials',
      expect.objectContaining({
        p_refresh_token_expires_at: '2026-08-19T10:00:00.000Z',
        p_refresh_lease_token: 'lease-token',
      })
    );
  });
});
