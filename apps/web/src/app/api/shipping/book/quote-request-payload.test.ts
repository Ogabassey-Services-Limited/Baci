import { describe, expect, it } from 'vitest';
import { resolveBookingQuoteRequestPayload } from './quote-request-payload';

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

describe('resolveBookingQuoteRequestPayload', () => {
  it('reuses saved destination and item metadata for GIGL international bookings', () => {
    const payload = resolveBookingQuoteRequestPayload(
      {
        provider_code: 'GIGL',
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
            postalCode: 'M5V 3L9',
          },
          items: [
            {
              name: 'Phone',
              quantity: 1,
              weight: 1,
              value: 100_000,
              hsCode: '851712',
              length: 10,
              width: 8,
              height: 6,
            },
          ],
        },
      },
      receiver,
      items
    );

    expect(payload).toEqual({
      receiver: expect.objectContaining({
        name: 'Jane Customer',
        phone: '+14165550123',
        country: 'Canada',
        countryCode: 'CA',
        postalCode: 'M5V 3L9',
      }),
      items: [
        expect.objectContaining({
          hsCode: '851712',
          length: 10,
          width: 8,
          height: 6,
        }),
      ],
    });
  });

  it('keeps caller payloads for non-international quotes', () => {
    expect(
      resolveBookingQuoteRequestPayload(
        {
          provider_code: 'GIGL',
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
          provider_code: 'GIGL',
          provider_rate_id: 'GIGL_INTL_1_2_3_4',
        },
        receiver,
        items
      )
    ).toBeNull();
  });
});
