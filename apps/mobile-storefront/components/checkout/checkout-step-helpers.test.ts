import { describe, expect, it } from '@jest/globals';
import { PICKUP_STATION_ADDRESS_LINES } from '@/components/checkout/PickupStationCard';
import type { ShippingQuote } from '@/components/checkout/types';
import {
  AIRPORT_DELIVERY_FEE,
  getDeliveryMethodFee,
  getDeliveryMethodLabel,
  getDeliveryMethodSummary,
  getPaymentTabForMethod,
  getShippingProviderForMethod,
} from './checkout-step-helpers';

const baseQuote: ShippingQuote = {
  id: 'quote-1',
  displayName: 'Topship Express',
  price: 12500,
  provider: 'Topship',
  carrierName: 'Topship Express',
  estimatedDays: 3,
};

describe('checkout-step-helpers', () => {
  it('maps payment methods to the right tabs', () => {
    expect(getPaymentTabForMethod('paystack')).toBe('full');
    expect(getPaymentTabForMethod('credpal')).toBe('installments');
    expect(getPaymentTabForMethod('credit_direct')).toBe('installments');
    expect(getPaymentTabForMethod('klump')).toBe('installments');
    expect(getPaymentTabForMethod('invoice')).toBe('pay_later');
    expect(getPaymentTabForMethod('payforme')).toBe('pay_later');
  });

  it('resolves delivery fees by method', () => {
    expect(getDeliveryMethodFee('airport', baseQuote)).toBe(AIRPORT_DELIVERY_FEE);
    expect(getDeliveryMethodFee('pickup_station', baseQuote)).toBe(0);
    expect(getDeliveryMethodFee('door', baseQuote)).toBe(12500);
    expect(getDeliveryMethodFee('door', undefined)).toBe(0);
  });

  it('returns expected delivery labels', () => {
    expect(getDeliveryMethodLabel('airport')).toBe('Airport Delivery');
    expect(getDeliveryMethodLabel('pickup_station')).toBe('Pick Up Station');
    expect(getDeliveryMethodLabel('door')).toBe('Door Delivery');
  });

  it('returns delivery summaries by method and quote data', () => {
    expect(getDeliveryMethodSummary('airport', baseQuote)).toBe(
      'Est Delivery within 24-48 working hours'
    );
    expect(getDeliveryMethodSummary('pickup_station', baseQuote)).toBe(
      PICKUP_STATION_ADDRESS_LINES.join(', ')
    );
    expect(getDeliveryMethodSummary('door', baseQuote)).toBe(
      'Topship Express • 3 days'
    );
    expect(
      getDeliveryMethodSummary('door', { ...baseQuote, deliveryRange: '2-4 days' })
    ).toBe('Topship Express • 2-4 days');
    expect(
      getDeliveryMethodSummary('door', {
        ...baseQuote,
        provider: undefined,
        carrierName: undefined,
      })
    ).toBe('Topship • 3 days');
    expect(
      getDeliveryMethodSummary('door', {
        ...baseQuote,
        estimatedDays: undefined,
        deliveryRange: undefined,
      })
    ).toBe('Topship Express • Delivery estimate shown after selection');
    expect(getDeliveryMethodSummary('door', undefined)).toBe(
      'Topship • Delivery estimate shown after selection'
    );
  });

  it('returns the shipping provider for each delivery method', () => {
    expect(getShippingProviderForMethod('airport', baseQuote)).toBe(
      'Airport Delivery'
    );
    expect(getShippingProviderForMethod('pickup_station', baseQuote)).toBe(
      'Pick Up Station'
    );
    expect(getShippingProviderForMethod('door', baseQuote)).toBe('Topship');
    expect(
      getShippingProviderForMethod('door', {
        ...baseQuote,
        provider: undefined,
        carrierName: 'Carrier fallback',
      })
    ).toBe('Carrier fallback');
    expect(
      getShippingProviderForMethod('door', {
        ...baseQuote,
        provider: undefined,
        carrierName: undefined,
      })
    ).toBeUndefined();
    expect(getShippingProviderForMethod('door', undefined)).toBeUndefined();
  });
});
