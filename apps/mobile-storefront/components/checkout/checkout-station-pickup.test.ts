import { describe, expect, it } from '@jest/globals';
import {
  getDefaultPickupQuoteId,
  getPickupStationAddressLines,
  getPickupStationAddressText,
  getPickupStationLabel,
  getPickupStationMode,
  getShippingQuoteMode,
  getStationPickupQuote,
  isProviderStationPickupQuote,
} from './checkout-station-pickup';
import type { ShippingQuote } from './types';

const stationQuote: ShippingQuote = {
  displayName: 'GIG Logistics - Pickup at PORT HARCOURT',
  id: 'station-quote',
  isStationPickup: true,
  price: 9493,
  provider: 'GIGL',
  stationAddress: 'GIGL Aba Road, Port Harcourt',
  stationName: 'PORT HARCOURT',
};

describe('checkout station pickup helpers', () => {
  it('detects provider station-pickup quotes', () => {
    expect(isProviderStationPickupQuote(stationQuote)).toBe(true);
    expect(
      isProviderStationPickupQuote({ ...stationQuote, isStationPickup: false })
    ).toBe(false);
  });

  it('finds the first provider station-pickup quote', () => {
    expect(
      getStationPickupQuote([
        { displayName: 'Door', id: 'door', price: 10000 },
        stationQuote,
      ])
    ).toBe(stationQuote);
  });

  it('selects merchant pickup in Lagos and provider pickup elsewhere', () => {
    expect(getDefaultPickupQuoteId('Lagos', 'station-quote')).toBe(
      'merchant-office-pickup'
    );
    expect(getDefaultPickupQuoteId('Rivers', 'station-quote')).toBe(
      'station-quote'
    );
    expect(getDefaultPickupQuoteId('Rivers')).toBe('');
  });

  it('labels merchant and provider pickup stations separately', () => {
    expect(getPickupStationLabel()).toBe('Pick Up Station');
    expect(getPickupStationLabel(stationQuote)).toBe('Pickup Stations (GIGL)');
  });

  it('uses provider station address lines when available', () => {
    expect(getPickupStationAddressLines(stationQuote)).toEqual([
      'PORT HARCOURT',
      'GIGL Aba Road, Port Harcourt',
    ]);
    expect(getPickupStationAddressLines()).toEqual([]);
  });

  it('handles partial and missing provider station address data', () => {
    expect(
      getPickupStationAddressLines({
        ...stationQuote,
        stationAddress: undefined,
      })
    ).toEqual(['PORT HARCOURT']);
    expect(
      getPickupStationAddressLines({
        ...stationQuote,
        stationName: undefined,
      })
    ).toEqual(['GIGL Aba Road, Port Harcourt']);
    expect(
      getPickupStationAddressLines({
        ...stationQuote,
        displayName: 'Provider Pickup',
        stationAddress: undefined,
        stationName: undefined,
      })
    ).toEqual(['Provider Pickup']);
  });

  it('joins merchant and provider station address text', () => {
    expect(getPickupStationAddressText(undefined)).toBe('');
    expect(getPickupStationAddressText(stationQuote)).toBe(
      'PORT HARCOURT, GIGL Aba Road, Port Harcourt'
    );
    expect(getPickupStationAddressText(stationQuote, '\n')).toBe(
      'PORT HARCOURT\nGIGL Aba Road, Port Harcourt'
    );
  });

  it('keeps Lagos pickup and non-Lagos provider pickup modes separate', () => {
    expect(
      getPickupStationMode({
        city: 'Ikeja',
        deliveryMethod: 'pickup_station',
        state: 'Lagos',
      })
    ).toMatchObject({
      canUsePickupStation: true,
      usesMerchantPickup: true,
      usesProviderPickup: false,
    });

    expect(
      getPickupStationMode({
        city: 'Port Harcourt',
        deliveryMethod: 'pickup_station',
        state: 'Rivers',
      })
    ).toMatchObject({
      canUsePickupStation: true,
      usesMerchantPickup: false,
      usesProviderPickup: true,
    });
  });

  it('resolves the active quote preference and context for pickup delivery', () => {
    expect(
      getShippingQuoteMode({
        city: 'Ikeja',
        deliveryMethod: 'pickup_station',
        resolvedPreference: 'pickup_station',
        resolvedQuoteKey: 'Lagos|Ikeja',
        shippingQuoteContextKey: 'Lagos|Ikeja',
        shippingQuotes: [stationQuote],
        state: 'Lagos',
      })
    ).toMatchObject({
      currentQuotePreference: 'pickup_station',
      isCurrentQuoteContext: true,
      stationPickupQuote: stationQuote,
      usesDoorQuotes: false,
      usesPickupQuotes: true,
    });
  });

  it('does not expose a station quote from a stale quote context', () => {
    expect(
      getShippingQuoteMode({
        city: 'Ikeja',
        deliveryMethod: 'pickup_station',
        resolvedPreference: 'pickup_station',
        resolvedQuoteKey: 'Lagos|Lekki',
        shippingQuoteContextKey: 'Lagos|Ikeja',
        shippingQuotes: [stationQuote],
        state: 'Lagos',
      })
    ).toMatchObject({
      currentQuotePreference: 'pickup_station',
      isCurrentQuoteContext: false,
      stationPickupQuote: undefined,
      usesPickupQuotes: true,
    });
  });

  it.each([
    'door',
    'airport',
  ] as const)('uses door quotes for %s delivery', (deliveryMethod) => {
    expect(
      getShippingQuoteMode({
        city: 'Port Harcourt',
        deliveryMethod,
        resolvedPreference: 'door',
        resolvedQuoteKey: 'Rivers|Port Harcourt',
        shippingQuoteContextKey: 'Rivers|Port Harcourt',
        shippingQuotes: [stationQuote],
        state: 'Rivers',
      })
    ).toMatchObject({
      currentQuotePreference: 'door',
      isCurrentQuoteContext: true,
      usesDoorQuotes: true,
      usesPickupQuotes: false,
    });
  });

  it('does not activate pickup behavior for door delivery', () => {
    expect(
      getPickupStationMode({
        city: 'Port Harcourt',
        deliveryMethod: 'door',
        state: 'Rivers',
      })
    ).toMatchObject({
      canUsePickupStation: true,
      usesMerchantPickup: false,
      usesProviderPickup: false,
    });
  });

  it('requires a resolved location before provider pickup is active', () => {
    expect(
      getPickupStationMode({
        city: '',
        deliveryMethod: 'pickup_station',
        state: '',
      })
    ).toMatchObject({
      canUsePickupStation: false,
      hasResolvedDeliveryLocation: false,
      usesMerchantPickup: false,
      usesProviderPickup: false,
    });
  });

  it('recognizes an existing station quote as pickup availability', () => {
    expect(
      getPickupStationMode({
        city: '',
        deliveryMethod: 'pickup_station',
        state: '',
        stationPickupQuote: stationQuote,
      })
    ).toMatchObject({
      canUsePickupStation: true,
      hasResolvedDeliveryLocation: false,
      usesMerchantPickup: false,
      usesProviderPickup: false,
    });
  });
});
