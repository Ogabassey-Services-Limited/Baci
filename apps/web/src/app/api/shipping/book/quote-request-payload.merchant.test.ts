import { describe, expect, it } from 'vitest';
import {
  resolveBookingQuoteRequestPayload,
  validateBookingQuoteRequestPayload,
} from './quote-request-payload';

const address = {
  name: 'Jane Customer',
  phone: '+14165550123',
  address: '2 Customer Road',
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};

const items = [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }];
const order = {
  shipping_address: address,
  order_items: [{ name: 'Phone', quantity: 1, price: 100_000 }],
};

describe('validateBookingQuoteRequestPayload merchant binding', () => {
  it('accepts legacy saved international quotes without stored merchantId', () => {
    const payload = resolveBookingQuoteRequestPayload(
      {
        provider: 'GIGL',
        provider_rate_id: 'GIGL_INTL_1_2_3_1',
        quote_request: {
          sessionId: 'session-1',
          shipmentType: 'international',
          sender: address,
          receiver: address,
          items,
        },
      },
      address,
      items,
      [{ name: 'Phone', quantity: 1, price: 100_000 }]
    );

    expect(payload).not.toBeNull();
    if (!payload) return;

    expect(
      validateBookingQuoteRequestPayload(payload, order, 'merchant-current')
    ).toEqual({ ok: true });
  });

  it('rejects saved international quotes from another merchant', () => {
    const payload = resolveBookingQuoteRequestPayload(
      {
        provider: 'GIGL',
        provider_rate_id: 'GIGL_INTL_1_2_3_1',
        quote_request: {
          merchantId: 'merchant-other',
          sessionId: 'session-1',
          shipmentType: 'international',
          sender: address,
          receiver: address,
          items,
        },
      },
      address,
      items,
      [{ name: 'Phone', quantity: 1, price: 100_000 }]
    );

    expect(payload).not.toBeNull();
    if (!payload) return;

    expect(
      validateBookingQuoteRequestPayload(
        payload,
        { shipping_address: null, order_items: null },
        'merchant-current'
      )
    ).toMatchObject({
      ok: false,
      code: 'INTERNATIONAL_QUOTE_MERCHANT_MISMATCH',
    });
  });
});
