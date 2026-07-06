import { describe, expect, it } from 'vitest';
import { assertInternationalQuoteMatchesOrder } from './international-quote-order-guard';
import type { QuoteRequest } from './types';

const quoteRequest: QuoteRequest = {
  sessionId: 'session-1',
  shipmentType: 'international',
  receiver: {
    name: 'Jane Receiver',
    phone: '',
    email: 'old-recipient@example.com',
    address: '123 Queen Street West',
    city: 'Toronto',
    state: 'Ontario',
    country: 'Canada',
    countryCode: 'CA',
    postalCode: 'M5V 3L9',
  },
  items: [
    {
      name: 'Phone',
      quantity: 1,
      weight: 1.2,
      value: 100_000,
      hsCode: '851712',
      length: 10,
      width: 8,
      height: 6,
    },
  ],
};

const matchingOrder = {
  shipping_address: {
    address: '123 Queen Street West',
    city: 'Toronto',
    state: 'Ontario',
  },
  order_items: [{ name: 'Phone', quantity: 1, price: 100_000 }],
};

describe('assertInternationalQuoteMatchesOrder', () => {
  it('allows saved quote metadata when order address and items still match', () => {
    expect(() =>
      assertInternationalQuoteMatchesOrder(quoteRequest, matchingOrder)
    ).not.toThrow();
  });

  it('rejects stale saved quote destinations before booking', () => {
    expect(() =>
      assertInternationalQuoteMatchesOrder(quoteRequest, {
        ...matchingOrder,
        shipping_address: {
          ...matchingOrder.shipping_address,
          city: 'Vancouver',
        },
      })
    ).toThrow('no longer matches this order');
  });

  it('rejects stale saved quote items before booking', () => {
    expect(() =>
      assertInternationalQuoteMatchesOrder(quoteRequest, {
        ...matchingOrder,
        order_items: [{ name: 'Phone', quantity: 2, price: 100_000 }],
      })
    ).toThrow('no longer matches this order');
  });
});
