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

const item = {
  name: 'Phone',
  quantity: 1,
  weight: 1,
  value: 100_000,
  hsCode: '851712',
};

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

  it('requires HS codes for international quote items', () => {
    const result = QuoteRequestSchema.safeParse({
      shipmentType: 'international',
      receiver,
      items: [{ ...item, hsCode: '' }],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain(
      'items.0.hsCode'
    );
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

const domesticReceiver = {
  name: 'Jane Receiver',
  address: '12 Allen Avenue',
  city: 'Ikeja',
  state: 'Lagos',
};

describe('QuoteRequestSchema supports_merchant_rates capability flag', () => {
  it('defaults supports_merchant_rates to false when absent', () => {
    const result = QuoteRequestSchema.safeParse({
      shipmentType: 'domestic',
      receiver: domesticReceiver,
      items: [item],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.supports_merchant_rates).toBe(false);
  });

  it('accepts and preserves supports_merchant_rates: true', () => {
    const result = QuoteRequestSchema.safeParse({
      shipmentType: 'domestic',
      receiver: domesticReceiver,
      items: [item],
      supports_merchant_rates: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.supports_merchant_rates).toBe(true);
  });

  it('rejects a non-boolean supports_merchant_rates', () => {
    const result = QuoteRequestSchema.safeParse({
      shipmentType: 'domestic',
      receiver: domesticReceiver,
      items: [item],
      supports_merchant_rates: 'yes',
    });

    expect(result.success).toBe(false);
  });
});
