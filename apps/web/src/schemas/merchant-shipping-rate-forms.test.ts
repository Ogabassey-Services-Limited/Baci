import { describe, expect, it } from 'vitest';
import {
  rateFormSchema,
  zoneFormSchema,
  zoneLocationFormSchema,
} from './merchant-shipping-rate-forms';

describe('zoneLocationFormSchema', () => {
  it('uppercases country and subdivision codes', () => {
    const result = zoneLocationFormSchema.parse({
      countryCode: 'ng',
      subdivisionCode: 'ng-la',
    });

    expect(result).toEqual({ countryCode: 'NG', subdivisionCode: 'NG-LA' });
  });

  it('normalizes a missing subdivision to null (whole country)', () => {
    const result = zoneLocationFormSchema.parse({ countryCode: 'AE' });

    expect(result.subdivisionCode).toBeNull();
  });

  it('rejects a subdivision whose country prefix does not match', () => {
    const result = zoneLocationFormSchema.safeParse({
      countryCode: 'NG',
      subdivisionCode: 'IN-KA',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a malformed country code', () => {
    const result = zoneLocationFormSchema.safeParse({ countryCode: 'NGA' });

    expect(result.success).toBe(false);
  });
});

describe('zoneFormSchema', () => {
  it('accepts a zone with no locations (whole zone left unset)', () => {
    const result = zoneFormSchema.parse({ name: 'Everywhere else' });

    expect(result).toEqual({ name: 'Everywhere else', locations: [] });
  });

  it('accepts a zone with mixed country and subdivision locations', () => {
    const result = zoneFormSchema.parse({
      name: 'Lagos',
      locations: [
        { countryCode: 'ng', subdivisionCode: 'ng-la' },
        { countryCode: 'ae' },
      ],
    });

    expect(result.locations).toEqual([
      { countryCode: 'NG', subdivisionCode: 'NG-LA' },
      { countryCode: 'AE', subdivisionCode: null },
    ]);
  });

  it('rejects a blank name', () => {
    const result = zoneFormSchema.safeParse({ name: '   ' });

    expect(result.success).toBe(false);
  });
});

const baseRateInput = {
  zoneId: '11111111-1111-4111-8111-111111111111',
  name: 'Standard',
  kind: 'ship' as const,
  baseAmount: 1500,
  conditionType: 'always' as const,
};

describe('rateFormSchema', () => {
  it('accepts a minimal always-on flat rate and defaults optional fields', () => {
    const result = rateFormSchema.parse(baseRateInput);

    expect(result).toMatchObject({
      minSubtotal: null,
      maxSubtotal: null,
      freeOverAmount: null,
      deliveryMinDays: null,
      deliveryMaxDays: null,
      pickupAddress: null,
      sortOrder: 0,
      active: true,
    });
  });

  it('rejects a negative base amount', () => {
    const result = rateFormSchema.safeParse({
      ...baseRateInput,
      baseAmount: -1,
    });

    expect(result.success).toBe(false);
  });

  it('accepts a price-tier rate when min < max', () => {
    const result = rateFormSchema.parse({
      ...baseRateInput,
      conditionType: 'price_tier',
      minSubtotal: 0,
      maxSubtotal: 50_000,
    });

    expect(result.minSubtotal).toBe(0);
    expect(result.maxSubtotal).toBe(50_000);
  });

  it('rejects a price-tier rate when max <= min', () => {
    const result = rateFormSchema.safeParse({
      ...baseRateInput,
      conditionType: 'price_tier',
      minSubtotal: 50_000,
      maxSubtotal: 50_000,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['maxSubtotal']);
    }
  });

  it('rejects a zero free-over amount', () => {
    const result = rateFormSchema.safeParse({
      ...baseRateInput,
      freeOverAmount: 0,
    });

    expect(result.success).toBe(false);
  });

  it('accepts a positive free-over amount', () => {
    const result = rateFormSchema.parse({
      ...baseRateInput,
      freeOverAmount: 100_000,
    });

    expect(result.freeOverAmount).toBe(100_000);
  });

  it('rejects delivery days when max < min', () => {
    const result = rateFormSchema.safeParse({
      ...baseRateInput,
      deliveryMinDays: 5,
      deliveryMaxDays: 2,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['deliveryMaxDays']);
    }
  });

  it('accepts equal delivery min/max days', () => {
    const result = rateFormSchema.parse({
      ...baseRateInput,
      deliveryMinDays: 2,
      deliveryMaxDays: 2,
    });

    expect(result.deliveryMinDays).toBe(2);
    expect(result.deliveryMaxDays).toBe(2);
  });

  it('rejects a zero minimum delivery day (0 is the unknown-ETA sentinel)', () => {
    const result = rateFormSchema.safeParse({
      ...baseRateInput,
      deliveryMinDays: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['deliveryMinDays']);
    }
  });

  it('rejects a zero maximum delivery day (0 is the unknown-ETA sentinel)', () => {
    const result = rateFormSchema.safeParse({
      ...baseRateInput,
      deliveryMaxDays: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['deliveryMaxDays']);
    }
  });

  it('accepts a one-day (fastest real) delivery estimate', () => {
    const result = rateFormSchema.parse({
      ...baseRateInput,
      deliveryMinDays: 1,
      deliveryMaxDays: 1,
    });

    expect(result.deliveryMinDays).toBe(1);
    expect(result.deliveryMaxDays).toBe(1);
  });

  it('accepts null delivery days as the unknown/unspecified ETA', () => {
    const result = rateFormSchema.parse({
      ...baseRateInput,
      deliveryMinDays: null,
      deliveryMaxDays: null,
    });

    expect(result.deliveryMinDays).toBeNull();
    expect(result.deliveryMaxDays).toBeNull();
  });

  it('rejects a pickup rate with no pickup address', () => {
    const result = rateFormSchema.safeParse({
      ...baseRateInput,
      kind: 'pickup',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['pickupAddress']);
    }
  });

  it('rejects a pickup rate whose pickup address has no street address', () => {
    const result = rateFormSchema.safeParse({
      ...baseRateInput,
      kind: 'pickup',
      pickupAddress: { label: 'Main Store' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['pickupAddress']);
    }
  });

  it('rejects a pickup rate whose pickup address is all whitespace', () => {
    const result = rateFormSchema.safeParse({
      ...baseRateInput,
      kind: 'pickup',
      pickupAddress: { address: '   ' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['pickupAddress']);
    }
  });

  it('leaves ship rates unaffected by the pickup-address requirement', () => {
    const result = rateFormSchema.safeParse({
      ...baseRateInput,
      kind: 'ship',
      pickupAddress: {},
    });

    expect(result.success).toBe(true);
  });

  it('accepts a pickup rate with a pickup address', () => {
    const result = rateFormSchema.parse({
      ...baseRateInput,
      kind: 'pickup',
      pickupAddress: {
        label: 'Main Store',
        address: '12 Adeola Odeku',
        city: 'Lagos',
        countryCode: 'ng',
      },
    });

    expect(result.pickupAddress).toEqual({
      label: 'Main Store',
      address: '12 Adeola Odeku',
      city: 'Lagos',
      countryCode: 'NG',
    });
  });

  it('accepts an id for updates', () => {
    const result = rateFormSchema.parse({
      ...baseRateInput,
      id: '22222222-2222-4222-8222-222222222222',
    });

    expect(result.id).toBe('22222222-2222-4222-8222-222222222222');
  });
});
