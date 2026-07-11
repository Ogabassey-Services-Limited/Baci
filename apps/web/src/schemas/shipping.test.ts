import { describe, expect, it } from 'vitest';
import {
  BookingRequestSchema,
  QuoteRequestSchema,
  SelfFulfillmentSchema,
  SelfFulfillmentUpdateSchema,
} from './shipping';

const ORDER_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('SelfFulfillmentSchema dispatchPhone (optional rider number)', () => {
  it('accepts a payload with no dispatchPhone', () => {
    const result = SelfFulfillmentSchema.safeParse({ orderId: ORDER_ID });
    expect(result.success).toBe(true);
  });

  it('accepts an empty dispatchPhone', () => {
    const result = SelfFulfillmentSchema.safeParse({
      orderId: ORDER_ID,
      dispatchPhone: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a full dispatchPhone', () => {
    const result = SelfFulfillmentSchema.safeParse({
      orderId: ORDER_ID,
      dispatchPhone: '08034444444',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a partial dispatchPhone (provided but too short)', () => {
    const result = SelfFulfillmentSchema.safeParse({
      orderId: ORDER_ID,
      dispatchPhone: '0803',
    });
    expect(result.success).toBe(false);
  });
});

describe('SelfFulfillmentUpdateSchema dispatchPhone (optional rider number)', () => {
  it('accepts an empty dispatchPhone', () => {
    const result = SelfFulfillmentUpdateSchema.safeParse({
      orderId: ORDER_ID,
      dispatchPhone: '',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.dispatchPhone).toBeNull();
  });

  it('preserves null dispatchPhone as an explicit clear', () => {
    const result = SelfFulfillmentUpdateSchema.safeParse({
      orderId: ORDER_ID,
      dispatchPhone: null,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.dispatchPhone).toBeNull();
  });

  it('rejects a partial dispatchPhone (provided but too short)', () => {
    const result = SelfFulfillmentUpdateSchema.safeParse({
      orderId: ORDER_ID,
      dispatchPhone: '0803',
    });
    expect(result.success).toBe(false);
  });
});

describe('BookingRequestSchema international item metadata', () => {
  it('preserves customs and package dimensions for provider payloads', () => {
    const result = BookingRequestSchema.safeParse({
      orderId: ORDER_ID,
      carrierId: 'GIGL',
      quoteId: ORDER_ID,
      receiver: {
        name: 'Jane Receiver',
        phone: '+14165550123',
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
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.items[0]).toMatchObject({
      hsCode: '851712',
      length: 10,
      width: 8,
      height: 6,
    });
  });

  it('rejects invalid package dimensions before provider booking', () => {
    const result = BookingRequestSchema.safeParse({
      orderId: ORDER_ID,
      carrierId: 'GIGL',
      quoteId: ORDER_ID,
      receiver: {
        name: 'Jane Receiver',
        phone: '+14165550123',
        address: '123 Queen Street West',
        city: 'Toronto',
        state: 'Ontario',
        country: 'Canada',
        countryCode: 'CA',
      },
      items: [
        {
          name: 'Phone',
          quantity: 1,
          weight: 1,
          value: 100_000,
          length: -10,
          width: 8,
          height: 6,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects partial package dimensions before provider booking', () => {
    const result = BookingRequestSchema.safeParse({
      orderId: ORDER_ID,
      carrierId: 'GIGL',
      quoteId: ORDER_ID,
      receiver: {
        name: 'Jane Receiver',
        phone: '+14165550123',
        address: '123 Queen Street West',
        city: 'Toronto',
        state: 'Ontario',
        country: 'Canada',
        countryCode: 'CA',
      },
      items: [
        {
          name: 'Phone',
          quantity: 1,
          weight: 1,
          value: 100_000,
          length: 10,
          width: 8,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe('QuoteRequestSchema delivery preference', () => {
  it('accepts pickup-station quote preferences for domestic quotes', () => {
    const result = QuoteRequestSchema.safeParse({
      deliveryPreference: 'pickup_station',
      receiver: {
        name: 'Jane Receiver',
        address: '5 Customer Street',
        city: 'Port Harcourt',
        state: 'Rivers',
      },
      items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.deliveryPreference).toBe('pickup_station');
  });

  it('preserves receiver coordinates for nearest service-centre ranking', () => {
    const result = QuoteRequestSchema.safeParse({
      receiver: {
        name: 'Jane Receiver',
        address: '5 Customer Street',
        city: 'Port Harcourt',
        state: 'Rivers',
        latitude: 4.8156,
        longitude: 7.0498,
      },
      items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.receiver).toMatchObject({
      latitude: 4.8156,
      longitude: 7.0498,
    });
  });

  it.each([
    ['partial coordinates', { latitude: 4.8156 }],
    ['out-of-range coordinates', { latitude: 91, longitude: 7.0498 }],
    [
      'non-finite coordinates',
      { latitude: Number.POSITIVE_INFINITY, longitude: 7.0498 },
    ],
  ])('rejects %s', (_label, coordinates) => {
    const result = QuoteRequestSchema.safeParse({
      receiver: {
        name: 'Jane Receiver',
        address: '5 Customer Street',
        city: 'Port Harcourt',
        state: 'Rivers',
        ...coordinates,
      },
      items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects partial sender coordinates', () => {
    const result = QuoteRequestSchema.safeParse({
      receiver: {
        name: 'Jane Receiver',
        address: '5 Customer Street',
        city: 'Port Harcourt',
        state: 'Rivers',
      },
      sender: {
        name: 'Merchant',
        phone: '08012345678',
        address: '1 Merchant Road',
        city: 'Ikeja',
        state: 'Lagos',
        longitude: 3.3792,
      },
      items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported delivery preferences', () => {
    const result = QuoteRequestSchema.safeParse({
      deliveryPreference: 'express',
      receiver: {
        name: 'Jane Receiver',
        address: '5 Customer Street',
        city: 'Port Harcourt',
        state: 'Rivers',
      },
      items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
    });

    expect(result.success).toBe(false);
  });
});
