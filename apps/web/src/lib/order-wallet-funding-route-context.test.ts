import type { SupabaseClient, User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveWalletTopUpMerchant = vi.fn();
const mockResolveVtuCustomer = vi.fn();
const mockLoggerError = vi.fn();
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

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

import {
  ORDER_FUNDING_MERCHANT_SELECT,
  resolveOrderFundingMerchantAndCustomer,
} from '@/lib/order-wallet-funding-route-context';

const supabase = {} as unknown as SupabaseClient;
const user = { id: 'user-1' } as User;

describe('resolveOrderFundingMerchantAndCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a 404 response when the merchant cannot be resolved', async () => {
    mockResolveWalletTopUpMerchant.mockResolvedValueOnce(null);

    const result = await resolveOrderFundingMerchantAndCustomer({
      identifiers: { merchantSlug: 'unknown' },
      merchantSelect: ORDER_FUNDING_MERCHANT_SELECT,
      supabase,
      user,
    });

    expect('response' in result).toBe(true);
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(404);
    await expect(result.response.json()).resolves.toEqual({
      error: 'Merchant not found',
    });
  });

  it('returns a guest-checkout response when the customer is missing', async () => {
    mockResolveWalletTopUpMerchant.mockResolvedValueOnce({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockResolveVtuCustomer.mockResolvedValueOnce(null);

    const result = await resolveOrderFundingMerchantAndCustomer({
      identifiers: { merchantSlug: 'ogabassey' },
      merchantSelect: ORDER_FUNDING_MERCHANT_SELECT,
      supabase,
      user,
    });

    expect('response' in result).toBe(true);
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(409);
    await expect(result.response.json()).resolves.toEqual({
      code: 'GUEST_CHECKOUT',
      error: 'Customer not found',
    });
  });

  it('returns typed merchant and customer context on success', async () => {
    type MerchantWithSlug = { id: string; slug: string };
    const merchant: MerchantWithSlug = {
      id: 'merchant-1',
      slug: 'ogabassey',
    };
    const customer = { id: 'customer-1' };
    mockResolveWalletTopUpMerchant.mockResolvedValueOnce(merchant);
    mockResolveVtuCustomer.mockResolvedValueOnce(customer);

    const result =
      await resolveOrderFundingMerchantAndCustomer<MerchantWithSlug>({
        identifiers: { merchantSlug: 'ogabassey' },
        merchantSelect: ORDER_FUNDING_MERCHANT_SELECT,
        supabase,
        user,
      });

    if ('response' in result) throw new Error('expected context');
    const typedMerchant: MerchantWithSlug = result.merchant;
    expect(typedMerchant.slug).toBe('ogabassey');
    expect(result.customer).toBe(customer);
    // paystack_subaccount_code is SELECT-revoked from the authenticated role:
    // the merchant payment-config lookup must go through the service-role client.
    expect(mockResolveWalletTopUpMerchant).toHaveBeenCalledWith(
      mockAdminClient,
      { merchantSlug: 'ogabassey' },
      ORDER_FUNDING_MERCHANT_SELECT
    );
    // Customer resolution stays on the caller's authenticated RLS client.
    expect(mockResolveVtuCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ supabase })
    );
  });

  it('returns a 500 response when merchant resolution throws', async () => {
    mockResolveWalletTopUpMerchant.mockRejectedValueOnce(
      new Error('merchant lookup failed')
    );

    const result = await resolveOrderFundingMerchantAndCustomer({
      identifiers: { merchantSlug: 'ogabassey' },
      merchantSelect: ORDER_FUNDING_MERCHANT_SELECT,
      supabase,
      user,
    });

    expect('response' in result).toBe(true);
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toEqual({
      error: 'Unable to resolve merchant',
    });
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to resolve order-funding merchant context',
      })
    );
  });

  it('returns a 500 response when customer resolution throws', async () => {
    mockResolveWalletTopUpMerchant.mockResolvedValueOnce({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockResolveVtuCustomer.mockRejectedValueOnce(
      new Error('customer lookup failed')
    );

    const result = await resolveOrderFundingMerchantAndCustomer({
      identifiers: { merchantSlug: 'ogabassey' },
      merchantSelect: ORDER_FUNDING_MERCHANT_SELECT,
      supabase,
      user,
    });

    expect('response' in result).toBe(true);
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toEqual({
      error: 'Unable to resolve customer',
    });
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        message: 'Failed to resolve order-funding customer context',
      })
    );
  });

  it('rejects merchant select values outside the route whitelist', async () => {
    const result = await resolveOrderFundingMerchantAndCustomer({
      identifiers: { merchantSlug: 'ogabassey' },
      merchantSelect: 'id, slug, injected_column',
      supabase,
      user,
    });

    expect('response' in result).toBe(true);
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toEqual({
      error: 'Unable to resolve merchant',
    });
    expect(mockResolveWalletTopUpMerchant).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to resolve order-funding merchant context',
      })
    );
  });
});
