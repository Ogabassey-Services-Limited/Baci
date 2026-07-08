import { describe, expect, it } from '@jest/globals';
import type { RawOrderDetails } from './OrderDetailsScreen.types';
import { mapOrderDetails } from './order-details.helpers';

describe('mapOrderDetails', () => {
  it('preserves order item condition and variant labels from the order row', () => {
    const result = mapOrderDetails({
      id: 'order-1',
      order_number: 'ORD-1',
      shipping_status: 'pending',
      subtotal: 690000,
      shipping_fee: 0,
      tax_amount: 0,
      discount_amount: 0,
      total: 690000,
      payment_method: 'paystack',
      payment_status: 'pending',
      created_at: '2026-07-08T12:33:00.000Z',
      updated_at: '2026-07-08T12:33:00.000Z',
      shipping_address: {
        name: 'Customer',
        phone: '08000000000',
        address: '1 Test Street',
        city: 'Ikeja',
        state: 'Lagos',
      },
      order_items: [
        {
          id: 'item-1',
          product_id: 'product-1',
          name: '13" MacBook Air M2 (2022)',
          quantity: 1,
          price: 690000,
          condition: 'open_box',
          variant_name: '512GB',
          products: {
            images: ['https://cdn.example.com/macbook.jpg'],
            slug: 'macbook-air-m2',
          },
        },
      ],
    } as unknown as RawOrderDetails);

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        condition: 'open_box',
        variant_name: '512GB',
      })
    );
  });

  it('preserves null condition and undefined variant labels for legacy order rows', () => {
    const result = mapOrderDetails({
      id: 'order-1',
      order_number: 'ORD-1',
      shipping_status: 'pending',
      subtotal: 1000,
      shipping_fee: 0,
      tax_amount: 0,
      discount_amount: 0,
      total: 1000,
      payment_method: 'paystack',
      payment_status: 'pending',
      created_at: '2026-07-08T12:33:00.000Z',
      updated_at: '2026-07-08T12:33:00.000Z',
      shipping_address: {
        name: 'Customer',
        phone: '08000000000',
        address: '1 Test Street',
        city: 'Ikeja',
        state: 'Lagos',
      },
      order_items: [
        {
          id: 'item-2',
          product_id: 'product-2',
          name: 'Legacy item',
          quantity: 1,
          price: 1000,
          condition: null,
          variant_name: undefined,
          products: null,
        },
      ],
    } as unknown as RawOrderDetails);

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        condition: null,
        variant_name: undefined,
      })
    );
  });
});
