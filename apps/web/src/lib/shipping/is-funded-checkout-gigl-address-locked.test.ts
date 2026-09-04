import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isFundedCheckoutGiglAddressLocked } from './is-funded-checkout-gigl-address-locked';

vi.mock('@/lib/shipping/shipping-quote-booking-economics', () => ({
  getShippingQuoteBookingEconomics: vi.fn(),
}));

import { getShippingQuoteBookingEconomics } from '@/lib/shipping/shipping-quote-booking-economics';

describe('isFundedCheckoutGiglAddressLocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bugfix: loads retention via booking economics instead of revoked order columns', async () => {
    vi.mocked(getShippingQuoteBookingEconomics).mockResolvedValue({
      provider_cost: 5000,
      platform_margin: 1500,
      platform_margin_bps: 3000,
      pricing_version: 'v1',
      shipping_provider_cost: 5000,
      shipping_platform_margin: 1500,
      shipping_pricing_version: 'v1',
      shipping_platform_retained_amount: 2500,
    });

    await expect(
      isFundedCheckoutGiglAddressLocked(
        { rpc: vi.fn() } as never,
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

    expect(getShippingQuoteBookingEconomics).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      'order-1',
      'quote-1'
    );
  });

  it('does not lock when projected retention is zero', async () => {
    vi.mocked(getShippingQuoteBookingEconomics).mockResolvedValue({
      provider_cost: null,
      platform_margin: null,
      platform_margin_bps: null,
      pricing_version: null,
      shipping_provider_cost: null,
      shipping_platform_margin: null,
      shipping_pricing_version: null,
      shipping_platform_retained_amount: 0,
    });

    await expect(
      isFundedCheckoutGiglAddressLocked(
        { rpc: vi.fn() } as never,
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

  it('skips economics when the order is not a paid checkout-funded GIGL shipment', async () => {
    await expect(
      isFundedCheckoutGiglAddressLocked(
        { rpc: vi.fn() } as never,
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

    expect(getShippingQuoteBookingEconomics).not.toHaveBeenCalled();
  });
});
