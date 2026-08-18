import { describe, expect, it, vi } from 'vitest';
import { loadJumiaAuthorizationGrant } from '@/lib/jumia/load-jumia-authorization-grant';

describe('loadJumiaAuthorizationGrant', () => {
  it('returns the scoped authorization grant from the worker RPC', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
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
      }),
    };

    await expect(
      loadJumiaAuthorizationGrant(supabase as never, 'auth-1', 'merchant-1')
    ).resolves.toEqual({
      credential_ciphertext: 'opaque-ciphertext',
      token_expires_at: '2026-03-27T10:00:00.000Z',
      refresh_token_expires_at: '2026-04-27T10:00:00.000Z',
      rotation_version: 2,
      client_key_hash: 'a'.repeat(64),
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'load_jumia_authorization_credentials',
      {
        p_authorization_id: 'auth-1',
        p_merchant_id: 'merchant-1',
      }
    );
  });

  it('returns 404 when the worker RPC fails', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not authorized' },
      }),
    };

    await expect(
      loadJumiaAuthorizationGrant(supabase as never, 'auth-1', 'merchant-1')
    ).rejects.toThrow(
      /Jumia API Error \(404\): Jumia authorization grant not found/
    );
  });

  it('rejects a grant row without refresh-token expiry metadata', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            credential_ciphertext: 'opaque-ciphertext',
            token_expires_at: '2026-03-27T10:00:00.000Z',
            rotation_version: 2,
            client_key_hash: 'a'.repeat(64),
          },
        ],
        error: null,
      }),
    };

    await expect(
      loadJumiaAuthorizationGrant(supabase as never, 'auth-1', 'merchant-1')
    ).rejects.toMatchObject({ status: 404 });
  });
});
