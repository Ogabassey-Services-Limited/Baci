import { describe, expect, it, jest } from '@jest/globals';
import type { MutableRefObject } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import type { ShippingAddressInput } from '@/lib/validation';
import { createCheckoutShippingHandlers } from './checkout-shipping-handlers';

type HandlerParams = Parameters<typeof createCheckoutShippingHandlers>[0];
type SavedDoorAddress = NonNullable<
  HandlerParams['savedDoorAddressRef']['current']
>;

function createParams(overrides: Partial<HandlerParams> = {}): HandlerParams {
  return {
    committedAddress: '1 Airport Road, Port Harcourt',
    currentShippingQuoteContextKey: 'quote-context',
    deliveryCoordinates: { latitude: 4.8156, longitude: 7.0498 },
    deliveryMethod: 'door',
    googleSuggestedCityRef: { current: null },
    requestShippingQuotes: jest.fn(),
    resolvedShippingQuoteContextKey: 'quote-context',
    savedDoorAddressRef: { current: null },
    setCitySearch: jest.fn(),
    setCommittedAddress: jest.fn(),
    setDeliveryCoordinates: jest.fn(),
    setDeliveryMethod: jest.fn(),
    setResolvedShippingQuoteContextKey: jest.fn(),
    setSelectedQuoteId: jest.fn(),
    setShowCityPicker: jest.fn(),
    setShowStatePicker: jest.fn(),
    setValue: jest.fn() as jest.MockedFunction<
      UseFormSetValue<ShippingAddressInput>
    >,
    shippingQuoteAbortRef: { current: null },
    shippingStates: ['Rivers'],
    stationPickupQuote: undefined,
    watchedAddress: '1 Airport Road, Port Harcourt',
    watchedCity: 'Port Harcourt',
    watchedState: 'Rivers',
    ...overrides,
  };
}

describe('createCheckoutShippingHandlers', () => {
  it('restores Google coordinates when returning from pickup to road', () => {
    const coordinates = { latitude: 4.8156, longitude: 7.0498 };
    const savedDoorAddressRef = {
      current: null,
    } as MutableRefObject<SavedDoorAddress | null>;
    createCheckoutShippingHandlers(
      createParams({ deliveryCoordinates: coordinates, savedDoorAddressRef })
    ).handleSelectDeliveryMethod('pickup_station');
    expect(savedDoorAddressRef.current?.coordinates).toEqual(coordinates);

    const setDeliveryCoordinates = jest.fn();
    createCheckoutShippingHandlers(
      createParams({
        deliveryCoordinates: null,
        deliveryMethod: 'pickup_station',
        savedDoorAddressRef,
        setDeliveryCoordinates,
      })
    ).handleSelectDeliveryMethod('door');

    expect(setDeliveryCoordinates).toHaveBeenCalledWith(coordinates);
  });

  it('restores a saved road address without inventing missing coordinates', () => {
    const setDeliveryCoordinates = jest.fn();
    const requestShippingQuotes = jest.fn();
    const savedDoorAddressRef = {
      current: {
        address: '1 Airport Road, Port Harcourt',
        city: 'Port Harcourt',
        coordinates: null,
        state: 'Rivers',
      },
    } as MutableRefObject<SavedDoorAddress | null>;

    createCheckoutShippingHandlers(
      createParams({
        deliveryMethod: 'pickup_station',
        requestShippingQuotes,
        savedDoorAddressRef,
        setDeliveryCoordinates,
      })
    ).handleSelectDeliveryMethod('door');

    expect(setDeliveryCoordinates).toHaveBeenCalledWith(null);
    expect(requestShippingQuotes).not.toHaveBeenCalled();
  });
});
