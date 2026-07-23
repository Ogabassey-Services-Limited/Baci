import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { fetchMerchantPaystackSubaccountCode } from './fetch-merchant-payment-secret';

describe('fetchMerchantPaystackSubaccountCode', () => {
  it('reads paystack_subaccount_code via the SECURITY DEFINER RPC on the caller client', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'ACCT_123', error: null });
    const supabase = { rpc } as unknown as SupabaseClient;

    const result = await fetchMerchantPaystackSubaccountCode(
      supabase,
      'merchant-1'
    );

    expect(result).toBe('ACCT_123');
    expect(rpc).toHaveBeenCalledWith('get_merchant_paystack_subaccount_code', {
      p_merchant_id: 'merchant-1',
    });
  });

  it('returns null when the RPC yields null', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as SupabaseClient;

    await expect(
      fetchMerchantPaystackSubaccountCode(supabase, 'merchant-1')
    ).resolves.toBeNull();
  });

  it('throws when the RPC errors', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'permission denied' },
      }),
    } as unknown as SupabaseClient;

    await expect(
      fetchMerchantPaystackSubaccountCode(supabase, 'merchant-1')
    ).rejects.toThrow('Failed to load merchant payment configuration');
  });
});
