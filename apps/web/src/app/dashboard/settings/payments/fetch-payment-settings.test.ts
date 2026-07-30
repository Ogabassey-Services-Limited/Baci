import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPaymentSettings } from './fetch-payment-settings';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchPaymentSettings', () => {
  it('normalizes a successful response (korapay OFF when absent)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ paystack_enabled: true }),
      })
    );

    const result = await fetchPaymentSettings('merchant-b');

    expect(result).not.toBeNull();
    expect(result?.korapay_enabled).toBe(false);
    expect(result?.paystack_enabled).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      '/api/merchant/features?merchantId=merchant-b'
    );
  });

  it('honours an explicit korapay opt-in from the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ korapay_enabled: true }),
      })
    );

    const result = await fetchPaymentSettings();

    expect(result?.korapay_enabled).toBe(true);
  });

  it('returns null on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      })
    );

    expect(await fetchPaymentSettings()).toBeNull();
  });

  it('propagates a network rejection to the caller', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down'))
    );

    await expect(fetchPaymentSettings()).rejects.toThrow('network down');
  });
});
