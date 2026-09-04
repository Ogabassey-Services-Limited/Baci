import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isFundedCheckoutGiglAddressLocked } from './is-funded-checkout-gigl-address-locked';

vi.mock('@/lib/shipping/load-order-gigl-settled-retained-amount', () => ({
  loadOrderGiglSettledRetainedAmount: vi.fn(),
}));

import { loadOrderGiglSettledRetainedAmount } from '@/lib/shipping/load-order-gigl-settled-retained-amount';

describe('isFundedCheckoutGiglAddressLocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('locks when settled retention is positive', async () => {
    vi.mocked(loadOrderGiglSettledRetainedAmount).mockResolvedValue(2500);

    await expect(
      isFundedCheckoutGiglAddressLocked(
        { from: vi.fn() } as never,
        'merchant-1',
        'order-1',
        {
          shipping_provider: 'GIGL',
          payment_status: 'paid',
          shipping_funding_source: 'customer_checkout',
          selected_quote_id: 'quote-1',
        }
      )
    ).resolves.toBe(true);

    expect(loadOrderGiglSettledRetainedAmount).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      'order-1'
    );
  });

  it('bugfix: does not lock quiz_voucher / zero-settlement checkout with stamped quote retention', async () => {
    // Stamp trigger can project positive retained amount via quote economics,
    // but no merchant_settlements row retains shipping for quiz vouchers.
    vi.mocked(loadOrderGiglSettledRetainedAmount).mockResolvedValue(0);

    await expect(
      isFundedCheckoutGiglAddressLocked(
        { from: vi.fn() } as never,
        'merchant-1',
        'order-1',
        {
          shipping_provider: 'GIGL',
          payment_status: 'paid',
          shipping_funding_source: 'customer_checkout',
          selected_quote_id: 'quote-1',
        }
      )
    ).resolves.toBe(false);
  });

  it('skips settled retention when the order is not a paid checkout-funded GIGL shipment', async () => {
    await expect(
      isFundedCheckoutGiglAddressLocked(
        { from: vi.fn() } as never,
        'merchant-1',
        'order-1',
        {
          shipping_provider: 'GIGL',
          payment_status: 'paid',
          shipping_funding_source: 'merchant_wallet',
          selected_quote_id: 'quote-1',
        }
      )
    ).resolves.toBe(false);

    expect(loadOrderGiglSettledRetainedAmount).not.toHaveBeenCalled();
  });
});
