import { describe, expect, it } from 'vitest';
import {
  repairMerchantIdSchema,
  repairPlaceDetailsSchema,
} from './repair-actions';

describe('repairMerchantIdSchema', () => {
  it('accepts a valid uuid', () => {
    const result = repairMerchantIdSchema.safeParse(
      '123e4567-e89b-12d3-a456-426614174000'
    );

    expect(result.success).toBe(true);
  });

  it('rejects non-uuid merchant ids', () => {
    expect(repairMerchantIdSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(repairMerchantIdSchema.safeParse('').success).toBe(false);
    expect(repairMerchantIdSchema.safeParse(42).success).toBe(false);
  });
});

describe('repairPlaceDetailsSchema', () => {
  it('parses a complete place and preserves its fields', () => {
    const place = {
      streetNumber: '3',
      route: 'Olayeni Street',
      city: 'Ikeja',
      state: 'Lagos',
      zip: '100001',
      country: 'Nigeria',
      formattedAddress: '3 Olayeni Street, Ikeja, Lagos, Nigeria',
    };

    const result = repairPlaceDetailsSchema.safeParse(place);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected place to parse');
    expect(result.data).toEqual(place);
  });

  it('defaults non-required optional fields to empty strings', () => {
    const result = repairPlaceDetailsSchema.safeParse({
      city: 'Port Harcourt',
      state: 'Rivers',
      formattedAddress: '12 Aba Road, Port Harcourt, Rivers',
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected place to parse');
    expect(result.data.streetNumber).toBe('');
    expect(result.data.country).toBe('');
  });

  it('rejects oversized field values', () => {
    const result = repairPlaceDetailsSchema.safeParse({
      city: 'Ikeja',
      state: 'Lagos',
      formattedAddress: 'a'.repeat(501),
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty or incomplete pickup addresses', () => {
    expect(repairPlaceDetailsSchema.safeParse({}).success).toBe(false);
    expect(
      repairPlaceDetailsSchema.safeParse({
        formattedAddress: '12 Aba Road, Port Harcourt',
      }).success
    ).toBe(false);
    expect(
      repairPlaceDetailsSchema.safeParse({
        city: 'Port Harcourt',
        state: 'Rivers',
      }).success
    ).toBe(false);
  });

  it('rejects non-object payloads', () => {
    expect(repairPlaceDetailsSchema.safeParse(null).success).toBe(false);
    expect(repairPlaceDetailsSchema.safeParse('lagos').success).toBe(false);
  });
});
