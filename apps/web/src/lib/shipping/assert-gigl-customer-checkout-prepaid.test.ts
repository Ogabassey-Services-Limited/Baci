import { describe, expect, it } from 'vitest';
import {
  assertGiglCustomerCheckoutPrepaid,
  hasGiglCheckoutShippingRetention,
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

describe('hasGiglCheckoutShippingRetention', () => {
  it('requires customer_checkout funding with a positive retained amount', () => {
    expect(
      hasGiglCheckoutShippingRetention({
        shipping_funding_source: 'customer_checkout',
        shipping_platform_retained_amount: 2500,
      })
    ).toBe(true);
  });

  it('does not treat Paystack/Korapay as retention proof when funding source is null', () => {
    expect(
      hasGiglCheckoutShippingRetention({
        shipping_funding_source: null,
        shipping_platform_retained_amount: 0,
      })
    ).toBe(false);
  });

  it('rejects customer_checkout without a positive retained amount', () => {
    expect(
      hasGiglCheckoutShippingRetention({
        shipping_funding_source: 'customer_checkout',
        shipping_platform_retained_amount: 0,
      })
    ).toBe(false);
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
        shipping_platform_retained_amount: 2500,
      })
    ).not.toThrow();
  });

  it('rejects paid gateway orders with null funding source even when retained amount is positive', () => {
    expect(() =>
      assertGiglCustomerCheckoutPrepaid({
        shipping_provider: 'GIGL',
        shipping_funding_source: null,
        payment_status: 'paid',
        payment_method: 'paystack',
        shipping_platform_retained_amount: 2500,
      })
    ).toThrow(
      expect.objectContaining({ code: 'GIGL_REQUIRES_PREPAID_OR_WALLET' })
    );
  });

  it('rejects customer-checkout GIGL bookings paid with Credit Direct', () => {
    expect(() =>
      assertGiglCustomerCheckoutPrepaid({
        shipping_provider: 'GIGL',
        shipping_funding_source: 'customer_checkout',
        payment_status: 'paid',
        payment_method: 'credit_direct',
        shipping_platform_retained_amount: 0,
      })
    ).toThrow(
      expect.objectContaining({ code: 'GIGL_REQUIRES_PREPAID_OR_WALLET' })
    );
  });

  it('rejects manually paid customer-checkout GIGL bookings without retained shipping', () => {
    expect(() =>
      assertGiglCustomerCheckoutPrepaid({
        shipping_provider: 'GIGL',
        shipping_funding_source: 'customer_checkout',
        payment_status: 'paid',
        payment_method: 'manual',
        shipping_platform_retained_amount: 0,
      })
    ).toThrow(
      expect.objectContaining({ code: 'GIGL_REQUIRES_PREPAID_OR_WALLET' })
    );
  });

  it('rejects paid gateway checkouts that never retained GIGL shipping', () => {
    expect(() =>
      assertGiglCustomerCheckoutPrepaid({
        shipping_provider: 'GIGL',
        shipping_funding_source: 'customer_checkout',
        payment_status: 'paid',
        payment_method: 'paystack',
        shipping_platform_retained_amount: 0,
      })
    ).toThrow(
      expect.objectContaining({ code: 'GIGL_REQUIRES_PREPAID_OR_WALLET' })
    );
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
