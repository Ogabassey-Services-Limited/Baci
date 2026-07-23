import type { SupabaseClient, User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveWalletTopUpMerchant = vi.fn();
const mockResolveVtuCustomer = vi.fn();
const mockFetchPaystackSubaccountCode = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/lib/resolve-wallet-top-up-merchant', () => ({
  resolveWalletTopUpMerchant: (...args: unknown[]) =>
    mockResolveWalletTopUpMerchant(...args),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  resolveVtuCustomer: (...args: unknown[]) => mockResolveVtuCustomer(...args),
}));

vi.mock('@/lib/fetch-merchant-payment-secret', () => ({
  fetchMerchantPaystackSubaccountCode: (...args: unknown[]) =>
    mockFetchPaystackSubaccountCode(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

import { resolveOrderFundingMerchantAndCustomer } from '@/lib/order-wallet-funding-route-context';

const IDENTITY_SELECT = 'id, slug, business_name';
// Distinct object so the assertions prove identity resolution runs on the
// caller's authenticated RLS client, never a service-role client.
const supabase = { authScope: 'customer' } as unknown as SupabaseClient;
const user = { id: 'user-1' } as User;

describe('resolveOrderFundingMerchantAndCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a 404 response when the merchant cannot be resolved', async () => {
    mockResolveWalletTopUpMerchant.mockResolvedValueOnce(null);

    const result = await resolveOrderFundingMerchantAndCustomer({
      identifiers: { merchantSlug: 'unknown' },
      supabase,
      user,
    });

    expect('response' in result).toBe(true);
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(404);
    await expect(result.response.json()).resolves.toEqual({
      error: 'Merchant not found',
    });
    // No secret is read for a merchant the caller cannot resolve under RLS.
    expect(mockFetchPaystackSubaccountCode).not.toHaveBeenCalled();
  });

  it('returns a guest-checkout response when the customer is missing', async () => {
    mockResolveWalletTopUpMerchant.mockResolvedValueOnce({
      business_name: 'Oga',
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockResolveVtuCustomer.mockResolvedValueOnce(null);

    const result = await resolveOrderFundingMerchantAndCustomer({
      identifiers: { merchantSlug: 'ogabassey' },
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
    // The revoked secret is never read before the customer is verified.
    expect(mockFetchPaystackSubaccountCode).not.toHaveBeenCalled();
  });

  it('resolves identity under RLS and reads the secret via admin only after verifying the customer', async () => {
    const identity = {
      business_name: 'Oga',
      id: 'merchant-1',
      slug: 'ogabassey',
    };
    const customer = { id: 'customer-1' };
    mockResolveWalletTopUpMerchant.mockResolvedValueOnce(identity);
    mockResolveVtuCustomer.mockResolvedValueOnce(customer);
    mockFetchPaystackSubaccountCode.mockResolvedValueOnce('sub_123');

    const result = await resolveOrderFundingMerchantAndCustomer({
      identifiers: { merchantSlug: 'ogabassey' },
      supabase,
      user,
    });

    if ('response' in result) throw new Error('expected context');
    // Identity is resolved on the caller's RLS client with non-secret columns,
    // so an unpublished merchant is indistinguishable from a nonexistent one.
    expect(mockResolveWalletTopUpMerchant).toHaveBeenCalledWith(
      supabase,
      { merchantSlug: 'ogabassey' },
      IDENTITY_SELECT
    );
    // Customer is verified before the RLS-bypassing secret read.
    expect(mockResolveVtuCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-1', supabase })
    );
    expect(mockFetchPaystackSubaccountCode).toHaveBeenCalledWith(
      supabase,
      'merchant-1'
    );
    expect(result.merchant).toEqual({
      business_name: 'Oga',
      id: 'merchant-1',
      paystack_subaccount_code: 'sub_123',
      slug: 'ogabassey',
    });
    expect(result.customer).toBe(customer);
  });

  it('returns a 500 response when merchant resolution throws', async () => {
    mockResolveWalletTopUpMerchant.mockRejectedValueOnce(
      new Error('merchant lookup failed')
    );

    const result = await resolveOrderFundingMerchantAndCustomer({
      identifiers: { merchantSlug: 'ogabassey' },
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
      business_name: 'Oga',
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockResolveVtuCustomer.mockRejectedValueOnce(
      new Error('customer lookup failed')
    );

    const result = await resolveOrderFundingMerchantAndCustomer({
      identifiers: { merchantSlug: 'ogabassey' },
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
    // The secret read never runs when customer verification fails.
    expect(mockFetchPaystackSubaccountCode).not.toHaveBeenCalled();
  });
});
