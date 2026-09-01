import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('@/lib/jumia/server-credential-client', () => ({
  createJumiaCredentialServiceClient: vi.fn(() => ({ rpc: mockRpc })),
}));

import { loadJumiaAuthorizationGrant } from '@/lib/jumia/load-jumia-authorization-grant';

describe('loadJumiaAuthorizationGrant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the scoped authorization grant from the worker RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          credential_ciphertext: 'opaque-ciphertext',
          token_expires_at: '2026-03-27T10:00:00.000Z',
          refresh_token_expires_at: '2026-04-27T10:00:00.000Z',
          rotation_version: 2,
          client_key_hash: 'a'.repeat(64),
        },
      ],
      error: null,
    });

    await expect(
      loadJumiaAuthorizationGrant({} as never, 'auth-1', 'merchant-1')
    ).resolves.toEqual({
      credential_ciphertext: 'opaque-ciphertext',
      token_expires_at: '2026-03-27T10:00:00.000Z',
      refresh_token_expires_at: '2026-04-27T10:00:00.000Z',
      rotation_version: 2,
      client_key_hash: 'a'.repeat(64),
    });
    expect(mockRpc).toHaveBeenCalledWith(
      'load_jumia_authorization_credentials',
      {
        p_authorization_id: 'auth-1',
        p_merchant_id: 'merchant-1',
      }
    );
  });

  it('returns a retryable service error when the worker RPC fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Not authorized' },
    });

    await expect(
      loadJumiaAuthorizationGrant({} as never, 'auth-1', 'merchant-1')
    ).rejects.toMatchObject({ status: 503 });
  });

  it('preserves permission failures from the worker RPC', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'Not authorized' },
    });

    await expect(
      loadJumiaAuthorizationGrant({} as never, 'auth-1', 'merchant-1')
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a grant row without refresh-token expiry metadata', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          credential_ciphertext: 'opaque-ciphertext',
          token_expires_at: '2026-03-27T10:00:00.000Z',
          rotation_version: 2,
          client_key_hash: 'a'.repeat(64),
        },
      ],
      error: null,
    });

    await expect(
      loadJumiaAuthorizationGrant({} as never, 'auth-1', 'merchant-1')
    ).rejects.toMatchObject({ status: 404 });
  });
});
