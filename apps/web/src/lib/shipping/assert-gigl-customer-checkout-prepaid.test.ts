import { describe, expect, it } from 'vitest';
import {
  assertGiglCustomerCheckoutPrepaid,
  isPayOnDeliveryPaymentMethod,
} from './assert-gigl-customer-checkout-prepaid';
import { OrderShipmentBookingError } from './order-shipment-booking-utils';

describe('isPayOnDeliveryPaymentMethod', () => {
  it.each([
    'pod',
    'pay_on_delivery',
    'POD',
    ' Pay_On_Delivery ',
  ])('returns true for %s', (paymentMethod) => {
    expect(isPayOnDeliveryPaymentMethod(paymentMethod)).toBe(true);
  });

  it('returns false for prepaid gateway methods', () => {
    expect(isPayOnDeliveryPaymentMethod('paystack')).toBe(false);
  });
});

describe('assertGiglCustomerCheckoutPrepaid', () => {
  it('allows wallet-funded GIGL bookings for unpaid pay-on-delivery orders', () => {
    expect(() =>
      assertGiglCustomerCheckoutPrepaid({
        shipping_provider: 'GIGL',
        shipping_funding_source: 'merchant_wallet',
        payment_status: 'unpaid',
        payment_method: 'pay_on_delivery',
      })
    ).not.toThrow();
  });

  it('allows prepaid customer-checkout GIGL bookings', () => {
    expect(() =>
      assertGiglCustomerCheckoutPrepaid({
        shipping_provider: 'GIGL',
        shipping_funding_source: 'customer_checkout',
        payment_status: 'paid',
        payment_method: 'paystack',
      })
    ).not.toThrow();
  });

  it('rejects customer-checkout GIGL bookings when payment is unpaid', () => {
    expect(() =>
      assertGiglCustomerCheckoutPrepaid({
        shipping_provider: 'GIGL',
        shipping_funding_source: 'customer_checkout',
        payment_status: 'unpaid',
        payment_method: 'paystack',
      })
    ).toThrow(OrderShipmentBookingError);

    try {
      assertGiglCustomerCheckoutPrepaid({
        shipping_provider: 'GIGL',
        shipping_funding_source: 'customer_checkout',
        payment_status: 'unpaid',
        payment_method: 'paystack',
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: 'GIGL_REQUIRES_PREPAID_OR_WALLET',
        status: 400,
      });
    }
  });

  it('rejects customer-checkout GIGL bookings for pay-on-delivery orders', () => {
    expect(() =>
      assertGiglCustomerCheckoutPrepaid({
        shipping_provider: 'GIGL',
        shipping_funding_source: 'customer_checkout',
        payment_status: 'paid',
        payment_method: 'pay_on_delivery',
      })
    ).toThrow(
      expect.objectContaining({ code: 'GIGL_REQUIRES_PREPAID_OR_WALLET' })
    );
  });

  it('ignores non-GIGL providers', () => {
    expect(() =>
      assertGiglCustomerCheckoutPrepaid({
        shipping_provider: 'TOPSHIP',
        shipping_funding_source: 'customer_checkout',
        payment_status: 'unpaid',
        payment_method: 'pay_on_delivery',
      })
    ).not.toThrow();
  });
});
