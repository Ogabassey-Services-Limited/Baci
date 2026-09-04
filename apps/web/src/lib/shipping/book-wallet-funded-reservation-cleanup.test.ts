import { describe, expect, it, vi } from 'vitest';
import { hasActiveMerchantShippingCharge } from './book-wallet-funded-reservation-cleanup';

describe('hasActiveMerchantShippingCharge', () => {
  it('returns false when the client cannot query charges', async () => {
    await expect(
      hasActiveMerchantShippingCharge({} as never, 'o1', 'q1')
    ).resolves.toBe(false);
  });

  it('bugfix: treats provider_submitting charges as active before quote refresh', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ id: 'charge-1' }],
      error: null,
    });
    const statusIn = vi.fn(() => ({ limit }));
    const eqQuote = vi.fn(() => ({ in: statusIn }));
    const eqOrder = vi.fn(() => ({ eq: eqQuote }));
    const select = vi.fn(() => ({ eq: eqOrder }));
    const from = vi.fn(() => ({ select }));

    await expect(
      hasActiveMerchantShippingCharge({ from } as never, 'order-1', 'quote-1')
    ).resolves.toBe(true);

    expect(from).toHaveBeenCalledWith('merchant_shipping_charges');
    expect(statusIn).toHaveBeenCalledWith('status', [
      'reserved',
      'provider_submitting',
    ]);
  });
});
