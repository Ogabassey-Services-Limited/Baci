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
    setCustomerLookupResult({
      data: { user_id: 'user-1' },
      error: null,
    });

    await notifyWalletCredited({
      amount: 5000,
      currency: 'NGN',
      customerId: 'customer-1',
    });

    expect(mockNotifyCustomer).toHaveBeenCalledWith(
      'user-1',
      'Wallet funded',
      'NGN 5000 was added to your wallet.',
      { amount: 5000, currency: 'NGN', type: 'wallet_credited' },
      'payments'
    );
  });

  it('forwards a returnTo when provided so taps resume the interrupted purchase', async () => {
    setCustomerLookupResult({
      data: { user_id: 'user-1' },
      error: null,
    });

    await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
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
      'payments'
    );
  });

  it('is a no-op when the wallet credit push flag is disabled', async () => {
    mockIsWalletCreditPushEnabled.mockReturnValue(false);

    await notifyWalletCredited({ amount: 5000, customerId: 'customer-1' });

    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });

  it('never pushes when the customer has no linked user_id (guest)', async () => {
    setCustomerLookupResult({
      data: { user_id: null },
      error: null,
    });

    await notifyWalletCredited({ amount: 5000, customerId: 'customer-1' });

    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });

  it('never pushes when the customer row is missing', async () => {
    setCustomerLookupResult({ data: null, error: null });

    await notifyWalletCredited({ amount: 5000, customerId: 'customer-1' });

    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });

  it('never pushes when customer resolution errors (wrong-recipient protection)', async () => {
    setCustomerLookupResult({
      data: null,
      error: { message: 'lookup failed' },
    });

    await notifyWalletCredited({ amount: 5000, customerId: 'customer-1' });

    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });

  it('swallows unexpected errors so the caller is never affected', async () => {
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error('boom');
    });

    await expect(
      notifyWalletCredited({ amount: 5000, customerId: 'customer-1' })
    ).resolves.toBeUndefined();
    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });
});
