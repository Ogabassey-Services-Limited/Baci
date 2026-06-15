import { describe, expect, it } from '@jest/globals';
import { buildOrderPayload } from '@/services/orders.payload';
import { CreateOrderRequestSchema } from '@/services/orders.schemas';
import {
  buildCheckoutOrderRequest,
  createCheckoutSnapshot,
} from './checkout-order-builders';

const address = {
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: '08012345678',
  address: '1 Test Street',
  city: 'Lagos',
  state: 'Lagos',
};

describe('checkout order builders', () => {
  it('uses negotiated line prices but leaves expected_total to the API tax boundary', () => {
    const itemsSnapshot = [
      {
        id: 'line-1',
        product_id: 'product-1',
        slug: 'macbook-air-m1',
        name: 'MacBook Air M1',
        price: 690000,
        negotiatedPrice: 676200,
        negotiationStatus: 'accepted' as const,
        quantity: 1,
      },
    ];
    const snapshot = createCheckoutSnapshot(itemsSnapshot, 0, 50715);

    const request = buildCheckoutOrderRequest({
      address,
      customerEmail: 'ada@example.com',
      customerName: 'Ada Lovelace',
      customerPhone: '08012345678',
      deliveryMethod: 'door',
      itemsSnapshot,
      paymentMethodForOrder: 'credit_direct',
      selectedQuote: undefined,
      shippingProvider: undefined,
      snapshot,
    });

    expect(request.items[0].price).toBe(676200);
    expect(request.subtotal).toBe(676200);
    expect(request.tax_amount).toBe(50715);
    expect(request.expected_total).toBeUndefined();
    expect(request.client_total).toBeUndefined();
  });

  it('ignores stale negotiated prices for best-price items when building orders', () => {
    const itemsSnapshot = [
      {
        id: 'line-1',
        product_id: 'product-1',
        slug: 'tecno-spark-50',
        brand: 'Tecno',
        name: 'Tecno Spark 50',
        price: 150000,
        negotiatedPrice: 147000,
        negotiationStatus: 'accepted' as const,
        quantity: 1,
        hasAssurance: true,
      },
    ];
    const snapshot = createCheckoutSnapshot(itemsSnapshot, 0, 11250);

    const request = buildCheckoutOrderRequest({
      address,
      customerEmail: 'ada@example.com',
      customerName: 'Ada Lovelace',
      customerPhone: '08012345678',
      deliveryMethod: 'door',
      itemsSnapshot,
      paymentMethodForOrder: 'paystack',
      selectedQuote: undefined,
      shippingProvider: undefined,
      snapshot,
    });

    expect(request.items[0].price).toBe(150000);
    expect(request.items[0].assurance_fee).toBe(7500);
    expect(request.subtotal).toBe(150000);
    expect(request.expected_total).toBeUndefined();
    expect(request.client_total).toBeUndefined();
  });

  it('preserves expected_total through validation and payload serialization', () => {
    const parsed = CreateOrderRequestSchema.parse({
      customer_email: 'ada@example.com',
      customer_name: 'Ada Lovelace',
      customer_phone: '08012345678',
      items: [
        { id: 'product-1', name: 'MacBook Air M1', quantity: 1, price: 676200 },
      ],
      subtotal: 676200,
      shipping_fee: 0,
      tax_amount: 50715,
      expected_total: 726915,
      client_total: 726915,
      payment_method: 'credit_direct',
      shipping_address: address,
    });

    const payload = buildOrderPayload({
      merchantId: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
      request: parsed,
    });

    expect(payload.expected_total).toBe(726915);
    expect(payload.client_total).toBe(726915);
  });
});
