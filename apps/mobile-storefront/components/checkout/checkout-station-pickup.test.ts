import { describe, expect, it } from '@jest/globals';
import {
  getPickupStationAddressLines,
  getPickupStationAddressText,
  getPickupStationLabel,
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

  it('labels merchant and provider pickup stations separately', () => {
    expect(getPickupStationLabel()).toBe('Pick Up Station');
    expect(getPickupStationLabel(stationQuote)).toBe('Pickup Stations (GIGL)');
  });

  it('uses provider station address lines when available', () => {
    expect(getPickupStationAddressLines(stationQuote)).toEqual([
      'PORT HARCOURT',
      'GIGL Aba Road, Port Harcourt',
    ]);
    expect(getPickupStationAddressLines()).toContain('Taiyelolu Towers');
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
    expect(getPickupStationAddressText(undefined)).toContain(
      'Taiyelolu Towers'
    );
    expect(getPickupStationAddressText(stationQuote)).toBe(
      'PORT HARCOURT, GIGL Aba Road, Port Harcourt'
    );
    expect(getPickupStationAddressText(stationQuote, '\n')).toBe(
      'PORT HARCOURT\nGIGL Aba Road, Port Harcourt'
    );
  });
});
