import { describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import {
  PICKUP_STATION_CITY,
  PICKUP_STATION_STATE,
} from '@/components/checkout/pickup-station.constants';
import type { ShippingQuote } from '@/components/checkout/types';
import { useCheckoutStepActions } from './use-checkout-step-actions';

// useCheckoutSubmit pulls in the full order-submission stack; the address-step
// continue logic under test never calls it, so a no-op keeps the test focused.
jest.mock('./use-checkout-submit', () => ({ useCheckoutSubmit: () => jest.fn() }));
jest.mock('@/services/analytics', () => ({ trackCheckoutStep: jest.fn() }));
jest.mock('@/services/tiktok-checkout-route-tracking', () => ({
  trackCheckoutRoutePaymentInfo: jest.fn(),
}));

type Params = Parameters<typeof useCheckoutStepActions>[0];

function renderStepActions(overrides: Partial<Params>) {
  const setValue = jest.fn();
  // handleSubmit returns the actual submit handler; the address branch invokes
  // it but the returned handler is a no-op here (validation isn't under test).
  const handleSubmit = jest.fn(() => jest.fn());
  const params = {
    handleSubmit,
    setValue,
    setStep: jest.fn(),
    setIsContactCollapsed: jest.fn(),
    setIsDeliveryCollapsed: jest.fn(),
    selectedPayment: 'paystack',
    step: 'address',
    deliveryMethod: 'pickup_station',
    selectedQuote: undefined,
    ...overrides,
  } as unknown as Params;

  const { result } = renderHook(() => useCheckoutStepActions(params));
  return { result, setValue };
}

describe('useCheckoutStepActions — address continue', () => {
  it('fills the station address but preserves city/state for a provider station-pickup quote', () => {
    // A paid GIGL station-pickup quote depends on the customer's real city/state
    // for its quote context — those must NOT be overwritten with the merchant's
    // Lagos pickup counter, or the provider quote is cleared on the way to
    // payment. The required address is instead satisfied with the station's own
    // address (the delivery-address card is hidden for pickup).
    const { result, setValue } = renderStepActions({
      selectedQuote: {
        id: 'gigl',
        isStationPickup: true,
        stationName: 'PORT HARCOURT',
        stationAddress: 'GIGL Aba Road, Port Harcourt',
      } as ShippingQuote,
    });

    result.current.handleContinue();

    expect(setValue).toHaveBeenCalledWith(
      'address',
      'PORT HARCOURT, GIGL Aba Road, Port Harcourt',
      { shouldValidate: true }
    );
    expect(setValue).not.toHaveBeenCalledWith(
      'city',
      PICKUP_STATION_CITY,
      expect.anything()
    );
    expect(setValue).not.toHaveBeenCalledWith(
      'state',
      PICKUP_STATION_STATE,
      expect.anything()
    );
  });

  it('rewrites city/state to the merchant Lagos pickup when there is no provider quote', () => {
    const { result, setValue } = renderStepActions({ selectedQuote: undefined });

    result.current.handleContinue();

    expect(setValue).toHaveBeenCalledWith('city', PICKUP_STATION_CITY, {
      shouldValidate: true,
    });
    expect(setValue).toHaveBeenCalledWith('state', PICKUP_STATION_STATE, {
      shouldValidate: true,
    });
  });
});
