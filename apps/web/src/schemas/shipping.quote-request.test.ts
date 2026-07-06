import { describe, expect, it } from 'vitest';
import { QuoteRequestSchema } from './shipping';

const receiver = {
  name: 'Jane Receiver',
  address: '123 Queen Street West',
  city: 'Toronto',
  state: 'Ontario',
  country: 'Canada',
  countryCode: 'CA',
};

const item = { name: 'Phone', quantity: 1, weight: 1, value: 100_000 };

describe('QuoteRequestSchema international item metadata', () => {
  it('preserves customs and package dimensions for provider quote payloads', () => {
    const result = QuoteRequestSchema.safeParse({
      shipmentType: 'international',
      receiver: { ...receiver, postalCode: 'M5V 3L9' },
      sender: {
        name: 'Ogabassey',
        phone: '08034444444',
        address: 'Lagos',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      items: [
        {
          ...item,
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

  it('rejects partial package dimensions before provider quotes', () => {
    const result = QuoteRequestSchema.safeParse({
      shipmentType: 'international',
      receiver,
      items: [{ ...item, length: 10 }],
    });

    expect(result.success).toBe(false);
  });

  it('allows international quotes without sender so routes can use merchant fallback', () => {
    const result = QuoteRequestSchema.safeParse({
      shipmentType: 'international',
      receiver,
      items: [item],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sender).toBeUndefined();
  });

  it('defaults blank sender country fields for international quotes', () => {
    const result = QuoteRequestSchema.safeParse({
      shipmentType: 'international',
      receiver,
      sender: {
        name: 'Ogabassey',
        phone: '08034444444',
        address: 'Lagos',
        city: 'Lagos',
        state: 'Lagos',
        country: '',
        countryCode: '',
      },
      items: [item],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sender).toMatchObject({
      country: 'Nigeria',
      countryCode: 'NG',
    });
  });

  it('rejects blank receiver country fields for international quotes', () => {
    const result = QuoteRequestSchema.safeParse({
      shipmentType: 'international',
      receiver: { ...receiver, country: '', countryCode: '' },
      items: [item],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['receiver.country', 'receiver.countryCode'])
    );
  });

  it('requires explicit destination country for international quotes', () => {
    const result = QuoteRequestSchema.safeParse({
      shipmentType: 'international',
      receiver: {
        name: 'Jane Receiver',
        address: '123 Queen Street West',
        city: 'Toronto',
        state: 'Ontario',
      },
      items: [item],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['receiver.country', 'receiver.countryCode'])
    );
  });
});
