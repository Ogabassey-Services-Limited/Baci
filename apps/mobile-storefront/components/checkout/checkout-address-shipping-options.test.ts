import { describe, expect, it } from '@jest/globals';
import { getCheckoutAddressShippingOptions } from './checkout-address-shipping-options';
import type { ShippingQuote } from './types';

const doorQuote: ShippingQuote = {
  displayName: 'GIG Logistics - GoStandard',
  id: 'door',
  price: 5000,
  provider: 'GIGL',
};
const airQuote: ShippingQuote = {
  displayName: 'GIG Logistics - GoFaster',
  id: 'air',
  price: 8000,
  provider: 'GIGL',
  serviceTier: 'GoFaster',
};
const stationQuote: ShippingQuote = {
  displayName: 'GIG Logistics - Pickup at Ikeja',
  id: 'station',
  isStationPickup: true,
  price: 3000,
  provider: 'GIGL',
};

describe('getCheckoutAddressShippingOptions', () => {
  it('separates door, air, and station quotes for pickup delivery', () => {
    expect(
      getCheckoutAddressShippingOptions({
        deliveryMethod: 'pickup_station',
        selectedQuote: stationQuote,
        selectedQuoteId: 'station',
        shippingQuotes: [doorQuote, airQuote, stationQuote],
        watchedCity: 'Ikeja',
        watchedState: 'Lagos',
      })
    ).toMatchObject({
      airShippingQuotes: [airQuote],
      doorShippingQuotes: [doorQuote],
      effectiveSelectedQuoteId: 'station',
      providerPickupQuotes: [stationQuote],
      stationPickupQuote: stationQuote,
      usesMerchantPickup: true,
      usesProviderPickup: false,
    });
  });

  it('uses the local airport quote when no GoFaster quote is selected', () => {
    const options = getCheckoutAddressShippingOptions({
      deliveryMethod: 'airport',
      selectedQuote: doorQuote,
      selectedQuoteId: 'door',
      shippingQuotes: [doorQuote],
      watchedCity: 'Ikeja',
      watchedState: 'Lagos',
    });

    expect(options.effectiveSelectedQuoteId).toBe('airport-delivery');
    expect(options.localAirportQuote.displayName).toBe(
      'Ikeja Airport Delivery'
    );
  });

  it('does not expose a GoFaster selection as the selected door quote', () => {
    expect(
      getCheckoutAddressShippingOptions({
        deliveryMethod: 'airport',
        selectedQuote: airQuote,
        selectedQuoteId: 'air',
        shippingQuotes: [doorQuote, airQuote],
        watchedCity: 'Ikeja',
        watchedState: 'Lagos',
      }).doorSelectedQuote
    ).toBeUndefined();
  });
});
