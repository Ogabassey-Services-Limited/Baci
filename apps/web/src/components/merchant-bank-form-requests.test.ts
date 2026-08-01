import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiPostMock } = vi.hoisted(() => ({ apiPostMock: vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
}));

import {
  loadPaystackBanks,
  resolvePaystackAccount,
  saveBankSubaccount,
} from './merchant-bank-form-requests';

describe('merchant bank requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an actionable account-resolution error', async () => {
    apiPostMock.mockRejectedValueOnce(new Error('Account does not match bank'));

    await expect(resolvePaystackAccount('1234567890', '044')).resolves.toEqual({
      status: 'error',
      message: 'Account does not match bank',
    });
  });

  it('deduplicates bank codes from the loading endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          banks: [
            { code: '044', name: 'Guaranty Trust Bank' },
            { code: '044', name: 'GTBank' },
          ],
        }),
      })
    );

    await expect(loadPaystackBanks()).resolves.toEqual({
      status: 'ok',
      banks: [{ code: '044', name: 'Guaranty Trust Bank' }],
    });
  });

  it('returns a save failure without throwing', async () => {
    apiPostMock.mockRejectedValueOnce(new Error('Subaccount unavailable'));

    await expect(
      saveBankSubaccount({
        merchantId: '22222222-2222-4222-8222-222222222222',
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    ).resolves.toEqual({ status: 'error', message: 'Subaccount unavailable' });
  });
});
