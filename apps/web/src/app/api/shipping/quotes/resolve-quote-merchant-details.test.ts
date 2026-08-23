import { describe, expect, it, vi } from 'vitest';
import { resolveMerchantDetails } from './resolve-quote-merchant-details';

function createSupabase(result: unknown) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return {
    from: vi.fn(() => ({ select: vi.fn(() => query) })),
  };
}

describe('resolveMerchantDetails', () => {
  it('returns the sender fields and merchant currency context', async () => {
    const result = await resolveMerchantDetails(
      createSupabase({
        data: {
          business_address: '1 Merchant Road, Ikeja, Lagos',
          business_name: 'Merchant Store',
          phone: '08012345678',
          country: 'NG',
          payout_currency: 'NGN',
          state_code: 'LA',
        },
        error: null,
      }) as never,
      'merchant-1'
    );

    expect(result).toEqual(
      expect.objectContaining({
        business_name: 'Merchant Store',
        state_code: 'LA',
      })
    );
  });

  it('returns null when the merchant is not found', async () => {
    await expect(
      resolveMerchantDetails(
        createSupabase({ data: null, error: null }) as never,
        'merchant-1'
      )
    ).resolves.toBeNull();
  });

  it('returns a retryable error when the lookup fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(
      resolveMerchantDetails(
        createSupabase({
          data: null,
          error: { message: 'unavailable' },
        }) as never,
        'merchant-1'
      )
    ).resolves.toEqual({
      error: 'Failed to resolve merchant sender',
      ok: false,
      status: 500,
    });

    consoleError.mockRestore();
  });
});
