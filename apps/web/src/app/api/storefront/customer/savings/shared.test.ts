import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getCustomerSavingsFeatureSettings } from './shared';

describe('getCustomerSavingsFeatureSettings', () => {
  it('reads only customer-scoped savings settings through the protected RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          customer_device_savings_auto_debit_enabled: true,
          customer_device_savings_enabled: true,
          paystack_enabled: false,
        },
      ],
      error: null,
    });
    const supabase = { rpc } as unknown as SupabaseClient;

    const result = await getCustomerSavingsFeatureSettings({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      supabase,
    });

    expect(rpc).toHaveBeenCalledWith('get_customer_savings_feature_settings', {
      p_customer_id: 'customer-1',
      p_merchant_id: 'merchant-1',
    });
    expect(result).toEqual({
      autoDebitEnabled: true,
      paystackEnabled: false,
      savingsEnabled: true,
    });
  });

  it('keeps savings disabled and Paystack enabled when no settings row exists', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as SupabaseClient;

    await expect(
      getCustomerSavingsFeatureSettings({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        supabase,
      })
    ).resolves.toEqual({
      autoDebitEnabled: false,
      paystackEnabled: true,
      savingsEnabled: false,
    });
  });
});
