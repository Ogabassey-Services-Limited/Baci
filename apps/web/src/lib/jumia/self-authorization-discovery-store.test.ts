import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();

const mockSupabase = {
  rpc: (...args: unknown[]) => mockRpc(...args),
} as unknown as import('@supabase/supabase-js').SupabaseClient;

import {
  consumeJumiaSelfAuthorizationDiscovery,
  createJumiaSelfAuthorizationDiscovery,
  loadJumiaSelfAuthorizationDiscovery,
} from './self-authorization-discovery-store';

describe('jumia self-authorization discovery store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a discovery record through the authenticated RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: '00000000-0000-4000-8000-000000000099',
      error: null,
    });

    await expect(
      createJumiaSelfAuthorizationDiscovery(mockSupabase, {
        merchantId: 'merchant-1',
        clientKeyHash: 'a'.repeat(64),
        credentialCiphertext: 'ciphertext',
      })
    ).resolves.toBe('00000000-0000-4000-8000-000000000099');

    expect(mockRpc).toHaveBeenCalledWith(
      'create_jumia_self_authorization_discovery',
      {
        p_merchant_id: 'merchant-1',
        p_client_key_hash: 'a'.repeat(64),
        p_credential_ciphertext: 'ciphertext',
      }
    );
  });

  it('loads a matching discovery record without consuming it', async () => {
    mockRpc.mockResolvedValueOnce({
      data: 'ciphertext',
      error: null,
    });

    await expect(
      loadJumiaSelfAuthorizationDiscovery(mockSupabase, {
        discoveryId: '00000000-0000-4000-8000-000000000099',
        merchantId: 'merchant-1',
        clientKeyHash: 'a'.repeat(64),
      })
    ).resolves.toBe('ciphertext');

    expect(mockRpc).toHaveBeenCalledWith(
      'load_jumia_self_authorization_discovery',
      {
        p_discovery_id: '00000000-0000-4000-8000-000000000099',
        p_merchant_id: 'merchant-1',
        p_client_key_hash: 'a'.repeat(64),
      }
    );
  });

  it('consumes a matching discovery record once through the authenticated RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: 'ciphertext',
      error: null,
    });

    await expect(
      consumeJumiaSelfAuthorizationDiscovery(mockSupabase, {
        discoveryId: '00000000-0000-4000-8000-000000000099',
        merchantId: 'merchant-1',
        clientKeyHash: 'a'.repeat(64),
      })
    ).resolves.toBe('ciphertext');

    expect(mockRpc).toHaveBeenCalledWith(
      'consume_jumia_self_authorization_discovery',
      {
        p_discovery_id: '00000000-0000-4000-8000-000000000099',
        p_merchant_id: 'merchant-1',
        p_client_key_hash: 'a'.repeat(64),
      }
    );
  });
});
