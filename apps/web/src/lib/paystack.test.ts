import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('paystack helpers', () => {
  beforeEach(() => {
    vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_123');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('resolveAccountNumber accepts alphanumeric bank codes and calls fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: 'ok',
          data: {
            account_number: '1234567890',
            account_name: 'Jane Doe',
          },
        }),
      })
    );

    const { resolveAccountNumber } = await import('@/lib/paystack');
    const result = await resolveAccountNumber('1234567890', '035A');

    expect(result.success).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('bank_code=035A'),
      expect.any(Object)
    );
  });

  it('resolveAccountNumber rejects bank codes with punctuation', async () => {
    const { resolveAccountNumber } = await import('@/lib/paystack');
    const result = await resolveAccountNumber('1234567890', 'ABC-123');

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns a validation error when saved-card charge payload is incomplete', async () => {
    const { chargeAuthorization } = await import('@/lib/paystack');
    const result = await chargeAuthorization({
      amount: 0,
      authorization_code: '',
      email: '',
    });

    expect(result).toEqual({
      success: false,
      error: 'Authorization code, email, and amount are required',
      code: 'VALIDATION_ERROR',
    });
  });

  it('includes authorization details in verifyTransaction responses', async () => {
    const { verifyTransaction } = await import('@/lib/paystack');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: 'ok',
          data: {
            id: 1,
            status: 'success',
            reference: 'REF123',
            amount: 100000,
            currency: 'NGN',
            channel: 'card',
            paid_at: '2026-04-08T12:00:00.000Z',
            created_at: '2026-04-08T12:00:00.000Z',
            customer: {
              id: 1,
              email: 'customer@example.com',
              customer_code: 'CUS_123',
              first_name: null,
              last_name: null,
              phone: null,
            },
            metadata: null,
            authorization: {
              authorization_code: 'AUTH_123',
              card_type: 'visa DEBIT',
              last4: '1234',
              exp_month: '08',
              exp_year: '2030',
              bank: 'Access Bank',
              channel: 'card',
              signature: 'SIG_123',
              reusable: true,
              country_code: 'NG',
            },
            fees: 150,
            fees_split: null,
          },
        }),
      })
    );

    const result = await verifyTransaction('REF123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authorization).toMatchObject({
        authorization_code: 'AUTH_123',
        reusable: true,
        signature: 'SIG_123',
      });
    }
  });
});
