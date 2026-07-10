import { describe, expect, it, vi } from 'vitest';
import type { ShippingQuote } from './types';
import {
  createSelectDeliveryMethod,
  getDoorDeliveryQuotes,
  getPreferredDoorQuoteId,
  getSelectedQuoteIdForDeliveryMethod,
  getStationPickupAddressText,
  getStationPickupQuote,
  getStationPickupQuotes,
  isStationPickupQuote,
  resetDeliveryQuotesForAddressChange,
} from './utils';

const doorQuote: ShippingQuote = {
  carrierName: 'GIG Logistics',
  currency: 'NGN',
  displayName: 'Door Delivery',
  estimatedDays: 3,
  id: 'door-1',
  insuranceIncluded: true,
  pickupIncluded: true,
  price: 3500,
  provider: 'GIGL',
  serviceTier: 'Standard',
};

const stationQuote: ShippingQuote = {
  ...doorQuote,
  displayName: 'Pickup Stations (GIGL)',
  id: 'station-1',
  isStationPickup: true,
  price: 2500,
  stationAddress: '1 Service Centre Road',
  stationName: 'Ikeja Service Centre',
};

const secondStationQuote: ShippingQuote = {
  ...stationQuote,
  id: 'station-2',
  stationAddress: '5 Allen Avenue',
  stationName: 'Allen Service Centre',
};

describe('checkout shipping quote helpers', () => {
  it('separates door and provider pickup station quotes', () => {
    const quotes = [stationQuote, doorQuote, secondStationQuote];

    expect(isStationPickupQuote(stationQuote)).toBe(true);
    expect(getDoorDeliveryQuotes(quotes)).toEqual([doorQuote]);
    expect(getStationPickupQuote(quotes)).toBe(stationQuote);
    expect(getStationPickupQuotes(quotes)).toEqual([
      stationQuote,
      secondStationQuote,
    ]);
    expect(getPreferredDoorQuoteId(quotes)).toBe('door-1');
  });

  it('selects a matching quote when switching delivery methods', () => {
    const quotes = [doorQuote, stationQuote];

    expect(getSelectedQuoteIdForDeliveryMethod('pickup_station', 'door-1', quotes)).toBe(
      'station-1'
    );
    expect(getSelectedQuoteIdForDeliveryMethod('door', 'station-1', quotes)).toBe(
      'door-1'
    );
    expect(getSelectedQuoteIdForDeliveryMethod('pickup', 'station-1', quotes)).toBe(
      'station-1'
    );
  });

  it('keeps a previously chosen pickup station when re-entering pickup_station', () => {
    const quotes = [doorQuote, stationQuote, secondStationQuote];

    expect(
      getSelectedQuoteIdForDeliveryMethod('pickup_station', 'station-2', quotes)
    ).toBe('station-2');
    expect(
      getSelectedQuoteIdForDeliveryMethod('pickup_station', 'door-1', quotes)
    ).toBe('station-1');
    expect(
      getSelectedQuoteIdForDeliveryMethod('pickup_station', '', quotes)
    ).toBe('station-1');
  });

  it('binds delivery method selection to quote and method setters', () => {
    const setDeliveryMethod = vi.fn();
    const setSelectedQuoteId = vi.fn();
    const selectDeliveryMethod = createSelectDeliveryMethod({
      selectedQuoteId: 'door-1',
      setDeliveryMethod,
      setSelectedQuoteId,
      shippingQuotes: [doorQuote, stationQuote],
    });

    selectDeliveryMethod('pickup_station');

    expect(setSelectedQuoteId).toHaveBeenCalledWith('station-1');
    expect(setDeliveryMethod).toHaveBeenCalledWith('pickup_station');
  });

  it('formats station pickup address text from available station fields', () => {
    expect(getStationPickupAddressText(stationQuote)).toBe(
      'Ikeja Service Centre, 1 Service Centre Road'
    );
    expect(
      getStationPickupAddressText({
        ...stationQuote,
        stationAddress: undefined,
      })
    ).toBe('Ikeja Service Centre');
  });

  it('clears stale delivery quotes when the address changes', () => {
    const setDeliveryMethod = vi.fn();
    const setSelectedQuoteId = vi.fn();
    const setShippingQuotes = vi.fn();

    resetDeliveryQuotesForAddressChange({
      setDeliveryMethod,
      setSelectedQuoteId,
      setShippingQuotes,
    });

    expect(setShippingQuotes).toHaveBeenCalledWith([]);
    expect(setSelectedQuoteId).toHaveBeenCalledWith('');
    expect(setDeliveryMethod).toHaveBeenCalledWith('door');
  });
});
