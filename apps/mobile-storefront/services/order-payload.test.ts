import { describe, expect, it } from '@jest/globals';
import { buildMobileOrderPayload } from './order-payload';
import type { CreateOrderRequest } from './orders';

function baseRequest(
  overrides: Partial<CreateOrderRequest> = {}
): CreateOrderRequest {
  return {
    customer_email: 'test@example.com',
    customer_name: 'Test User',
    customer_phone: '+2348012345678',
    items: [
      {
        id: 'item-1',
        name: 'Phone',
        price: 150000,
        quantity: 2,
      },
    ],
    subtotal: 300000,
    shipping_fee: 2000,
    payment_method: 'card',
    shipping_address: {
      firstName: 'Test',
      lastName: 'User',
      address: '123 Street',
      city: 'Lagos',
      state: 'Lagos',
    },
    source: 'mobile',
    ...overrides,
  };
}

describe('buildMobileOrderPayload', () => {
  it('maps mobile order fields into the web API payload', () => {
    const payload = buildMobileOrderPayload(baseRequest(), {
      merchantId: 'merchant-1',
      userId: 'user-1',
    });

    expect(payload).toEqual(
      expect.objectContaining({
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        customer_phone: '+2348012345678',
        merchant_id: 'merchant-1',
        payment_status: 'unpaid',
        shipping_provider: null,
        source: 'mobile_app',
        user_id: 'user-1',
      })
    );
    expect(payload.items).toEqual([
      expect.objectContaining({
        assurance_fee: 0,
        has_assurance: false,
        id: 'item-1',
        product_id: 'item-1',
        value: 300000,
        variant_attributes: {},
      }),
    ]);
  });

  it.each([
    'invoice',
    'payforme',
    'pay_on_delivery',
  ])('marks %s orders as pending so they remain actionable orders', (paymentMethod) => {
    const payload = buildMobileOrderPayload(
      baseRequest({ payment_method: paymentMethod }),
      { merchantId: 'merchant-1' }
    );

    expect(payload).toEqual(
      expect.objectContaining({
        payment_method: paymentMethod,
        payment_status: 'pending',
      })
    );
  });

  it('forwards only fully formed wallet and savings intents', () => {
    const payload = buildMobileOrderPayload(
      baseRequest({
        use_wallet_credit: true,
        wallet_amount: 10_000,
        use_savings_credit: true,
        savings_amount: 20_000,
        savings_goal_id: '11111111-1111-4111-8111-111111111111',
      }),
      { merchantId: 'merchant-1' }
    );

    expect(payload).toEqual(
      expect.objectContaining({
        use_savings_credit: true,
        savings_amount: 20_000,
        savings_goal_id: '11111111-1111-4111-8111-111111111111',
        use_wallet_credit: true,
        wallet_amount: 10_000,
      })
    );

    const malformedPayload = buildMobileOrderPayload(
      baseRequest({
        use_wallet_credit: true,
        wallet_amount: 0,
        use_savings_credit: true,
      }),
      { merchantId: 'merchant-1' }
    );

    expect(malformedPayload).not.toHaveProperty('use_wallet_credit');
    expect(malformedPayload).not.toHaveProperty('wallet_amount');
    expect(malformedPayload).not.toHaveProperty('use_savings_credit');
    expect(malformedPayload).not.toHaveProperty('savings_amount');
  });
});
