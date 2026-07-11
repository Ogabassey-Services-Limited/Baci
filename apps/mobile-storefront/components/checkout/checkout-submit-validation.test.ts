import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { MutableRefObject } from 'react';
import { Alert } from 'react-native';
import { validateCheckoutSubmission } from './checkout-submit-validation';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

function baseParams(
  overrides: Partial<Parameters<typeof validateCheckoutSubmission>[0]> = {}
): Parameters<typeof validateCheckoutSubmission>[0] {
  return {
    availablePaymentMethods: ['paystack'],
    currentShippingQuoteContextKey: 'Rivers|Port Harcourt|cart',
    deliveryMethod: 'door',
    isLoadingQuotes: false,
    isOrderInFlight: { current: false } as MutableRefObject<boolean>,
    isProcessing: false,
    itemsLength: 1,
    requiresShippingQuote: true,
    resolvedShippingQuoteContextKey: 'Rivers|Port Harcourt|cart',
    selectedPayment: 'paystack',
    selectedQuote: {
      displayName: 'GIG Logistics - Home Delivery',
      id: 'quote-1',
      price: 10_000,
    },
    setStep: jest.fn(),
    ...overrides,
  };
}

describe('validateCheckoutSubmission shipping quote requirement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks provider pickup without a selected station quote', () => {
    const setStep = jest.fn();

    const result = validateCheckoutSubmission(
      baseParams({
        deliveryMethod: 'pickup_station',
        selectedQuote: undefined,
        setStep,
      })
    );

    expect(result).toBe(false);
    expect(alertSpy).toHaveBeenCalledWith(
      'Shipping Required',
      'Please confirm a delivery option before placing your order.',
      [{ text: 'OK', onPress: expect.any(Function) }]
    );
  });

  it('allows provider pickup with a selected station quote', () => {
    expect(
      validateCheckoutSubmission(
        baseParams({
          deliveryMethod: 'pickup_station',
          selectedQuote: {
            displayName: 'GIG Logistics - Pickup at PORT HARCOURT',
            id: 'station-quote',
            isStationPickup: true,
            price: 9493,
            provider: 'GIGL',
            stationAddress: 'GIGL Aba Road, Port Harcourt',
            stationName: 'PORT HARCOURT',
          },
        })
      )
    ).toBe(true);
  });

  it('allows Lagos merchant pickup without a provider quote', () => {
    expect(
      validateCheckoutSubmission(
        baseParams({
          deliveryMethod: 'pickup_station',
          requiresShippingQuote: false,
          selectedQuote: undefined,
        })
      )
    ).toBe(true);
  });
});
