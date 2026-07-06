import { describe, expect, it } from 'vitest';
import {
  resolveBookingQuoteRequestPayload,
  validateBookingQuoteRequestPayload,
} from './quote-request-payload';

const receiver = {
  name: 'Jane Customer',
  phone: '+14165550123',
  address: '2 Customer Road',
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};

const items = [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }];
const sender = {
  name: 'Merchant Store',
  phone: '+2348011111111',
  address: '1 Merchant Road',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};

describe('resolveBookingQuoteRequestPayload', () => {
  it('reuses saved destination and derives item metadata from the order product', () => {
    const payload = resolveBookingQuoteRequestPayload(
      {
        provider: 'GIGL',
        provider_rate_id: 'GIGL_INTL_1_2_3_4',
        quote_request: {
          sessionId: 'session-1',
          shipmentType: 'international',
          sender,
          receiver: {
            name: 'Old Name',
            phone: '',
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
              value: 85_000,
              hsCode: '851712',
              length: 10,
              width: 8,
              height: 6,
            },
          ],
        },
      },
      receiver,
      items,
      [
        {
          name: 'Phone',
          quantity: 1,
          price: 100_000,
          product: {
            weight_value: 1.2,
            weight_unit: 'kg',
            dimensions: { length: 10, width: 8, height: 6, unit: 'cm' },
            commodity_code: '851712',
          },
        },
      ]
    );

    expect(payload).toEqual(
      expect.objectContaining({
        receiver: expect.objectContaining({
          name: 'Jane Customer',
          phone: '+14165550123',
          country: 'Canada',
          countryCode: 'CA',
          postalCode: 'M5V 3L9',
        }),
        items: [
          expect.objectContaining({
            weight: 1.2,
            hsCode: '851712',
            length: 10,
            width: 8,
            height: 6,
            value: 85_000,
          }),
        ],
      })
    );
  });

  it('keeps caller payloads for non-international quotes', () => {
    expect(
      resolveBookingQuoteRequestPayload(
        {
          provider: 'GIGL',
          provider_rate_id: 'gigl:service-centre:5',
        },
        receiver,
        items
      )
    ).toEqual({ receiver, items });
  });

  it('rejects GIGL international bookings without stored quote requests', () => {
    expect(
      resolveBookingQuoteRequestPayload(
        {
          provider: 'GIGL',
          provider_rate_id: 'GIGL_INTL_1_2_3_4',
        },
        receiver,
        items
      )
    ).toBeNull();
  });

  it('keeps saved international payloads without sender so merchant fallback can apply', () => {
    const payload = resolveBookingQuoteRequestPayload(
      {
        provider: 'GIGL',
        provider_rate_id: 'GIGL_INTL_1_2_3_4',
        quote_request: {
          sessionId: 'session-1',
          shipmentType: 'international',
          receiver: {
            name: 'Old Name',
            phone: '',
            address: '123 Queen Street West',
            city: 'Toronto',
            state: 'Ontario',
            country: 'Canada',
            countryCode: 'CA',
          },
          items,
        },
      },
      receiver,
      items,
      [{ name: 'Phone', quantity: 1, price: 100_000 }]
    );

    expect(payload).toEqual(
      expect.objectContaining({
        sender: undefined,
        receiver: expect.objectContaining({
          country: 'Canada',
          countryCode: 'CA',
        }),
      })
    );
  });
});

describe('validateBookingQuoteRequestPayload', () => {
  it('accepts saved international quotes that still match the order', () => {
    const payload = resolveBookingQuoteRequestPayload(
      {
        provider: 'GIGL',
        provider_rate_id: 'GIGL_INTL_1_2_3_4',
        quote_request: {
          sessionId: 'session-1',
          shipmentType: 'international',
          sender,
          receiver: {
            name: 'Old Name',
            phone: '',
            address: '123 Queen Street West',
            city: 'Toronto',
            state: 'Ontario',
            country: 'Canada',
            countryCode: 'CA',
          },
          items,
        },
      },
      receiver,
      items,
      [{ name: 'Phone', quantity: 1, price: 100_000 }]
    );

    expect(payload).not.toBeNull();
    if (!payload) return;

    expect(
      validateBookingQuoteRequestPayload(payload, {
        shipping_address: {
          address: '123 Queen Street West',
          city: 'Toronto',
          state: 'Ontario',
          country: 'Canada',
          countryCode: 'CA',
        },
        order_items: [{ name: 'Phone', quantity: 1 }],
      })
    ).toEqual({ ok: true });
  });

  it('accepts non-international pass-through payloads', () => {
    const payload = resolveBookingQuoteRequestPayload(
      {
        provider: 'GIGL',
        provider_rate_id: 'gigl:service-centre:5',
      },
      receiver,
      items
    );

    expect(payload).not.toBeNull();
    if (!payload) return;

    expect(
      validateBookingQuoteRequestPayload(payload, {
        shipping_address: null,
        order_items: null,
      })
    ).toEqual({ ok: true });
  });

  it('rejects saved international quotes that no longer match the order', () => {
    const payload = resolveBookingQuoteRequestPayload(
      {
        provider: 'GIGL',
        provider_rate_id: 'GIGL_INTL_1_2_3_4',
        quote_request: {
          sessionId: 'session-1',
          shipmentType: 'international',
          sender,
          receiver: {
            name: 'Old Name',
            phone: '',
            address: '123 Queen Street West',
            city: 'Toronto',
            state: 'Ontario',
            country: 'Canada',
            countryCode: 'CA',
          },
          items,
        },
      },
      receiver,
      items,
      [{ name: 'Phone', quantity: 1, price: 100_000 }]
    );

    expect(payload).not.toBeNull();
    if (!payload) return;

    expect(
      validateBookingQuoteRequestPayload(payload, {
        shipping_address: {
          address: '999 New Address',
          city: 'Toronto',
          state: 'Ontario',
          country: 'Canada',
          countryCode: 'CA',
        },
        order_items: [{ name: 'Phone', quantity: 1 }],
      })
    ).toEqual({
      ok: false,
      error:
        'The saved international shipping quote no longer matches this order. Please get a new quote before shipping.',
      code: 'INTERNATIONAL_QUOTE_ORDER_MISMATCH',
      status: 400,
    });
  });
});
