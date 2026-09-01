import { describe, expect, it } from 'vitest';
import { buildOrderGiglQuoteRequest } from './build-order-gigl-quote-request';

const sender = {
  name: 'Store',
  phone: '0800',
  address: 'Origin',
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};
const base = {
  id: 'o1',
  customer_name: 'Ada',
  customer_phone: '081',
  shipping_address: {
    address: 'Dest',
    city: 'Ikeja',
    state: 'Lagos',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  order_items: [
    { name: 'iPhone 15', quantity: 1, price: 500000, product_id: 'p1' },
  ],
};

describe('buildOrderGiglQuoteRequest', () => {
  it('converts grams and multiplies quantities', async () => {
    const result = await buildOrderGiglQuoteRequest(
      {
        ...base,
        order_items: [
          {
            ...base.order_items[0],
            quantity: 2,
            weight_value: 500,
            weight_unit: 'g',
          },
        ],
      },
      sender
    );
    expect(result.ok && result.request.items[0]).toMatchObject({
      weight: 0.5,
      quantity: 2,
    });
  });
  it('uses one kilogram fallback for unusable product weight', async () => {
    const result = await buildOrderGiglQuoteRequest(base, sender, async () => ({
      p1: { weight_value: 0, weight_unit: 'kg' },
    }));
    expect(result.ok && result.request.items).toEqual([
      expect.objectContaining({ name: 'iPhone 15', quantity: 1, weight: 1 }),
    ]);
  });
  it('reports exact missing receiver fields and rejects empty items', async () => {
    const missing = await buildOrderGiglQuoteRequest(
      { ...base, shipping_address: {} },
      sender
    );
    expect(missing).toMatchObject({
      code: 'ORDER_SHIPPING_ADDRESS_INCOMPLETE',
      missing: ['address', 'city', 'state'],
    });
    const empty = await buildOrderGiglQuoteRequest(
      { ...base, order_items: [] },
      sender
    );
    expect(empty).toMatchObject({ code: 'ORDER_SHIPPING_ITEMS_EMPTY' });
  });
});
