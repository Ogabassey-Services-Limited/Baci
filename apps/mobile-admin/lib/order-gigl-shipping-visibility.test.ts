import { describe, expect, it } from 'vitest';
import { getOrderGiglShippingVisibility } from './order-gigl-shipping-visibility';

describe('getOrderGiglShippingVisibility', () => {
  it('shows GIGL wallet actions only to the merchant owner', () => {
    expect(
      getOrderGiglShippingVisibility({
        merchantOwnerId: 'owner-1',
        userId: 'owner-1',
      }).isMerchantOwner
    ).toBe(true);
    expect(
      getOrderGiglShippingVisibility({
        merchantOwnerId: 'owner-1',
        userId: 'staff-1',
      }).isMerchantOwner
    ).toBe(false);
  });

  it('keeps a saved merchant-wallet GIGL quote in the funding flow', () => {
    const visibility = getOrderGiglShippingVisibility({
      order: {
        selected_quote_id: 'quote-1',
        shipping_funding_source: 'merchant_wallet',
        shipping_provider: 'GIGL',
      },
    });

    expect(visibility.isSavedMerchantWalletGiglOrder).toBe(true);
    expect(visibility.providerBookingAvailable).toBe(false);
  });

  it('only enables direct provider booking for an unbooked selected quote', () => {
    expect(
      getOrderGiglShippingVisibility({
        order: {
          selected_quote_id: 'quote-1',
          shipping_provider: 'GIGL',
          shipment_id: null,
          tracking_number: null,
        },
      }).providerBookingAvailable
    ).toBe(true);

    expect(
      getOrderGiglShippingVisibility({
        order: {
          selected_quote_id: 'quote-1',
          shipping_provider: 'GIGL',
          shipment_id: 'shipment-1',
          tracking_number: null,
        },
      }).providerBookingAvailable
    ).toBe(false);
  });
});
