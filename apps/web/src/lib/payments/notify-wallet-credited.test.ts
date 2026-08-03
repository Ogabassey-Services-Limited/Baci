import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsWalletCreditPushEnabled = vi.hoisted(() => vi.fn());
const mockNotifyCustomer = vi.hoisted(() => vi.fn());
const mockCreateAdminClient = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());

vi.mock('@/env', () => ({
  isWalletCreditPushEnabled: mockIsWalletCreditPushEnabled,
}));

vi.mock('@/lib/expo-push', () => ({
  // Real formatting behavior is not under test here; keep it deterministic.
  formatCurrency: (amount: number, currency = 'NGN') => `${currency} ${amount}`,
  notifyCustomer: mockNotifyCustomer,
}));

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { notifyWalletCredited } from '@/lib/payments/notify-wallet-credited';

function setCustomerLookupResult(result: {
  data: { user_id: string | null } | null;
  error: { message: string } | null;
}) {
  mockMaybeSingle.mockResolvedValue(result);
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mockMaybeSingle,
  };
  const from = vi.fn(() => chain);
  mockCreateAdminClient.mockReturnValue({ from });
  return { from, chain };
}

describe('notifyWalletCredited', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsWalletCreditPushEnabled.mockReturnValue(true);
    mockNotifyCustomer.mockResolvedValue({ sent: 1, failed: 0, errors: [] });
  });

  it('pushes to the resolved customer on the payments channel', async () => {
    const { chain } = setCustomerLookupResult({
      data: { user_id: 'user-1' },
      error: null,
    });

    const result = await notifyWalletCredited({
      amount: 5000,
      currency: 'NGN',
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(mockNotifyCustomer).toHaveBeenCalledWith(
      'user-1',
      'Wallet funded',
      'NGN 5000 was added to your wallet.',
      { amount: 5000, currency: 'NGN', type: 'wallet_credited' },
      'payments',
      {
        merchantId: 'merchant-1',
        onDeliveryRejected: expect.any(Function),
        onDeliveryStart: expect.any(Function),
      }
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 'customer-1');
    expect(chain.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(result).toEqual({ status: 'sent' });
  });

  it('forwards a returnTo when provided so taps resume the interrupted purchase', async () => {
    setCustomerLookupResult({
      data: { user_id: 'user-1' },
      error: null,
    });

    await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      returnTo: '/checkout',
    });

    expect(mockNotifyCustomer).toHaveBeenCalledWith(
      'user-1',
      'Wallet funded',
      'NGN 5000 was added to your wallet.',
      {
        amount: 5000,
        currency: 'NGN',
        returnTo: '/checkout',
        type: 'wallet_credited',
      },
      'payments',
      // Delivery scoped to the crediting merchant's storefront tokens.
      {
        merchantId: 'merchant-1',
        onDeliveryRejected: expect.any(Function),
        onDeliveryStart: expect.any(Function),
      }
    );
  });

  it('is a no-op when the wallet credit push flag is disabled', async () => {
    mockIsWalletCreditPushEnabled.mockReturnValue(false);

    const result = await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockNotifyCustomer).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'not_applicable' });
  });

  it('never pushes when the customer has no linked user_id (guest)', async () => {
    setCustomerLookupResult({
      data: { user_id: null },
      error: null,
    });

    await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });

  it('never pushes when the customer row is missing', async () => {
    setCustomerLookupResult({ data: null, error: null });

    await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });

  it('never pushes when customer resolution errors (wrong-recipient protection)', async () => {
    setCustomerLookupResult({
      data: null,
      error: { message: 'lookup failed' },
    });

    const result = await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(mockNotifyCustomer).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'retryable_error' });
  });

  it('reports a failed recorded send as retryable', async () => {
    setCustomerLookupResult({
      data: { user_id: 'user-1' },
      error: null,
    });
    mockNotifyCustomer.mockResolvedValue({
      sent: 0,
      failed: 1,
      errors: ['expo unavailable'],
    });

    const result = await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ status: 'retryable_error' });
  });

  it('treats a failed ticket count as retryable even without error text', async () => {
    setCustomerLookupResult({
      data: { user_id: 'user-1' },
      error: null,
    });
    mockNotifyCustomer.mockResolvedValue({ sent: 0, failed: 1, errors: [] });

    const result = await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ status: 'retryable_error' });
  });

  it('retains a confirmed send when another token delivery fails', async () => {
    setCustomerLookupResult({
      data: { user_id: 'user-1' },
      error: null,
    });
    mockNotifyCustomer.mockResolvedValue({ sent: 1, failed: 1, errors: [] });

    const result = await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ status: 'sent' });
  });

  it('does not retry when there were no eligible push tokens', async () => {
    setCustomerLookupResult({
      data: { user_id: 'user-1' },
      error: null,
    });
    mockNotifyCustomer.mockResolvedValue({ sent: 0, failed: 0, errors: [] });

    const result = await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ status: 'not_applicable' });
  });

  it('does not retry when the sender throws after delivery may have started', async () => {
    setCustomerLookupResult({
      data: { user_id: 'user-1' },
      error: null,
    });
    mockNotifyCustomer.mockImplementation(async (...args: unknown[]) => {
      const options = args[5] as { onDeliveryStart?: () => void };
      options.onDeliveryStart?.();
      throw new Error('ticket persistence unavailable');
    });

    const result = await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ status: 'delivery_unknown' });
  });

  it('retries when the sender throws before Expo delivery starts', async () => {
    setCustomerLookupResult({
      data: { user_id: 'user-1' },
      error: null,
    });
    mockNotifyCustomer.mockRejectedValue(new Error('token lookup unavailable'));

    const result = await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ status: 'retryable_error' });
  });

  it('swallows unexpected errors so the caller is never affected', async () => {
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error('boom');
    });

    await expect(
      notifyWalletCredited({
        amount: 5000,
        customerId: 'customer-1',
        merchantId: 'merchant-1',
      })
    ).resolves.toEqual({ status: 'retryable_error' });
    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });
});
