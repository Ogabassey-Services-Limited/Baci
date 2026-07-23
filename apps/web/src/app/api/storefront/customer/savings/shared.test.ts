import type { SupabaseClient, User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveWalletTopUpMerchant = vi.fn();
const mockResolveVtuCustomer = vi.fn();
const mockAdminClient = { role: 'service-role' } as unknown as SupabaseClient;

vi.mock('@/lib/resolve-wallet-top-up-merchant', () => ({
  resolveWalletTopUpMerchant: (...args: unknown[]) =>
    mockResolveWalletTopUpMerchant(...args),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  resolveVtuCustomer: (...args: unknown[]) => mockResolveVtuCustomer(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

import {
  getCustomerSavingsFeatureSettings,
  resolveCustomerSavingsContext,
} from './shared';

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

describe('resolveCustomerSavingsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads merchant payment config via the service-role client while resolving the customer on the authenticated client', async () => {
    const merchant = {
      business_name: 'Ogabassey',
      id: 'merchant-1',
      paystack_subaccount_code: 'ACCT_secret',
      slug: 'ogabassey',
    };
    const customer = { id: 'customer-1' };
    mockResolveWalletTopUpMerchant.mockResolvedValue(merchant);
    mockResolveVtuCustomer.mockResolvedValue(customer);
    const authClient = { authScope: 'customer' } as unknown as SupabaseClient;

    const result = await resolveCustomerSavingsContext({
      identifiers: { merchantSlug: 'ogabassey' },
      supabase: authClient,
      user: { id: 'user-1' } as User,
    });

    if ('response' in result) throw new Error('expected context');
    expect(result.merchant).toBe(merchant);
    expect(result.customer).toBe(customer);
    // paystack_subaccount_code is SELECT-revoked from the authenticated role:
    // the merchant payment-config lookup must go through the service-role client.
    expect(mockResolveWalletTopUpMerchant).toHaveBeenCalledWith(
      mockAdminClient,
      { merchantSlug: 'ogabassey' },
      'id, slug, business_name, paystack_subaccount_code'
    );
    // Customer resolution stays on the caller's authenticated RLS client.
    expect(mockResolveVtuCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ supabase: authClient })
    );
  });

  it('returns 404 without resolving a customer when the merchant is not found', async () => {
    mockResolveWalletTopUpMerchant.mockResolvedValue(null);

    const result = await resolveCustomerSavingsContext({
      identifiers: { merchantSlug: 'missing-store' },
      supabase: {} as unknown as SupabaseClient,
      user: { id: 'user-1' } as User,
    });

    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(404);
    await expect(result.response.json()).resolves.toEqual({
      error: 'Merchant not found',
    });
    expect(mockResolveVtuCustomer).not.toHaveBeenCalled();
  });
});
