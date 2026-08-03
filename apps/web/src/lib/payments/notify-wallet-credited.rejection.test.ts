import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsWalletCreditPushEnabled = vi.hoisted(() => vi.fn());
const mockNotifyCustomer = vi.hoisted(() => vi.fn());
const mockCreateAdminClient = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());

vi.mock('@/env', () => ({
  isWalletCreditPushEnabled: mockIsWalletCreditPushEnabled,
}));

vi.mock('@/lib/expo-push', () => ({
  formatCurrency: (amount: number, currency = 'NGN') => `${currency} ${amount}`,
  notifyCustomer: mockNotifyCustomer,
}));

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { notifyWalletCredited } from './notify-wallet-credited';

function setCustomerLookupResult() {
  mockMaybeSingle.mockResolvedValue({
    data: { user_id: 'user-1' },
    error: null,
  });
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mockMaybeSingle,
  };
  mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => chain) });
}

describe('notifyWalletCredited definitive rejection recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsWalletCreditPushEnabled.mockReturnValue(true);
  });

  it('retries after definitive Expo rejection even if delivery already started', async () => {
    setCustomerLookupResult();
    mockNotifyCustomer.mockImplementation(async (...args: unknown[]) => {
      const options = args[5] as {
        onDeliveryRejected?: () => void;
        onDeliveryStart?: () => void;
      };
      options.onDeliveryStart?.();
      options.onDeliveryRejected?.();
      return { sent: 0, failed: 1, errors: ['MessageRateExceeded'] };
    });

    const result = await notifyWalletCredited({
      amount: 5000,
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ status: 'retryable_error' });
  });
});
