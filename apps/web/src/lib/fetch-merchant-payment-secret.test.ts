import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockCreateAdminClient = vi.fn(() => ({ from: mockFrom }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

import { fetchMerchantPaystackSubaccountCode } from './fetch-merchant-payment-secret';

describe('fetchMerchantPaystackSubaccountCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads paystack_subaccount_code for the given id via the service-role client', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { paystack_subaccount_code: 'ACCT_123' },
      error: null,
    });

    const result = await fetchMerchantPaystackSubaccountCode('merchant-1');

    expect(result).toBe('ACCT_123');
    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('merchants');
    expect(mockSelect).toHaveBeenCalledWith('paystack_subaccount_code');
    expect(mockEq).toHaveBeenCalledWith('id', 'merchant-1');
  });

  it('returns null when the merchant row is missing', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      fetchMerchantPaystackSubaccountCode('missing')
    ).resolves.toBeNull();
  });

  it('returns null when the column is null', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { paystack_subaccount_code: null },
      error: null,
    });

    await expect(
      fetchMerchantPaystackSubaccountCode('merchant-1')
    ).resolves.toBeNull();
  });

  it('throws when the query errors', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(
      fetchMerchantPaystackSubaccountCode('merchant-1')
    ).rejects.toThrow('Failed to load merchant payment configuration');
  });
});
