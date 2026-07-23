import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { fetchMerchantPaystackConfigured } from './fetch-merchant-paystack-configured';

function clientWithRpc(result: { data?: unknown; error?: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: result.data ?? null,
      error: result.error ?? null,
    }),
  } as unknown as SupabaseClient;
}

describe('fetchMerchantPaystackConfigured', () => {
  it('returns true when the derived RPC reports a configured subaccount', async () => {
    const supabase = clientWithRpc({ data: true });

    const configured = await fetchMerchantPaystackConfigured(
      supabase,
      'merchant-1'
    );

    expect(configured).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_merchant_paystack_subaccount_configured',
      { p_merchant_id: 'merchant-1' }
    );
  });

  it('returns false when the RPC reports not configured', async () => {
    const supabase = clientWithRpc({ data: false });

    await expect(
      fetchMerchantPaystackConfigured(supabase, 'merchant-1')
    ).resolves.toBe(false);
  });

  it('returns false when the RPC yields no row (caller lacks merchant access)', async () => {
    const supabase = clientWithRpc({ data: null });

    await expect(
      fetchMerchantPaystackConfigured(supabase, 'merchant-1')
    ).resolves.toBe(false);
  });

  it('throws with the RPC error message when the lookup fails', async () => {
    const supabase = clientWithRpc({ error: { message: 'rpc unavailable' } });

    await expect(
      fetchMerchantPaystackConfigured(supabase, 'merchant-1')
    ).rejects.toThrow(
      'Failed to load merchant payment configuration: rpc unavailable'
    );
  });
});
