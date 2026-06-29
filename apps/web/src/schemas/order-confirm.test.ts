import { describe, expect, it } from 'vitest';
import {
  confirmOrderBodySchema,
  confirmOrderRouteParamsSchema,
  deviceInsuranceDetailsSchema,
  isStrictPastDateOnly,
  strictPastDateOnlySchema,
} from './order-confirm';

describe('isStrictPastDateOnly', () => {
  it('accepts a valid past calendar date', () => {
    expect(isStrictPastDateOnly('1995-04-12')).toBe(true);
  });

  it('rejects malformed, impossible, future, or today dates', () => {
    expect(isStrictPastDateOnly('not-a-date')).toBe(false);
    expect(isStrictPastDateOnly('2025-02-31')).toBe(false); // impossible
    expect(isStrictPastDateOnly('3000-01-01')).toBe(false); // future
    const today = new Date().toISOString().slice(0, 10);
    expect(isStrictPastDateOnly(today)).toBe(false);
  });
});

describe('strictPastDateOnlySchema', () => {
  it('parses a past date and rejects a future one', () => {
    expect(strictPastDateOnlySchema.safeParse('1990-01-01').success).toBe(true);
    expect(strictPastDateOnlySchema.safeParse('3000-01-01').success).toBe(
      false
    );
  });
});

describe('confirmOrderRouteParamsSchema', () => {
  it('requires a uuid id', () => {
    expect(
      confirmOrderRouteParamsSchema.safeParse({
        id: '00000000-0000-0000-0000-000000000000',
      }).success
    ).toBe(true);
    expect(
      confirmOrderRouteParamsSchema.safeParse({ id: 'nope' }).success
    ).toBe(false);
  });
});

describe('deviceInsuranceDetailsSchema', () => {
  const valid = {
    imei: '123456789012345',
    serialNumber: 'SN-123',
    deviceColor: 'Black',
    deviceModel: 'iPhone 16 Pro',
    deviceMake: 'Apple',
    deviceType: 'Phone',
    deviceValue: 1_200_000,
    purchaseDate: '2026-06-15',
    devicePhotos: { about: 'https://cdn.usebaci.com/orders/device.jpg' },
    gender: 'Male',
    dateOfBirth: '1995-04-12',
  };

  it('parses valid device insurance details', () => {
    expect(deviceInsuranceDetailsSchema.safeParse(valid).success).toBe(true);
  });

  it('requires real KYC (gender + past date of birth)', () => {
    const { gender: _g, ...withoutGender } = valid;
    expect(deviceInsuranceDetailsSchema.safeParse(withoutGender).success).toBe(
      false
    );
    expect(
      deviceInsuranceDetailsSchema.safeParse({
        ...valid,
        dateOfBirth: '3000-01-01',
      }).success
    ).toBe(false);
  });

  it('rejects a non-URL device photo', () => {
    expect(
      deviceInsuranceDetailsSchema.safeParse({
        ...valid,
        devicePhotos: { about: 'not-a-url' },
      }).success
    ).toBe(false);
  });
});

describe('confirmOrderBodySchema', () => {
  const validDevice = {
    imei: '123456789012345',
    serialNumber: 'SN-123',
    deviceColor: 'Black',
    deviceModel: 'iPhone 16 Pro',
    deviceMake: 'Apple',
    deviceType: 'Phone',
    deviceValue: 1_200_000,
    purchaseDate: '2026-06-15',
    devicePhotos: { about: 'https://cdn.usebaci.com/orders/device.jpg' },
    gender: 'Male',
    dateOfBirth: '1995-04-12',
  };

  it('treats a plain confirm (no device fields) as a no-op for insurance', () => {
    const result = confirmOrderBodySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shouldPurchaseInsurance).toBe(false);
      expect(result.data.deviceDetails).toBeNull();
    }
  });

  it('ignores unrelated extra keys on a plain confirm', () => {
    const result = confirmOrderBodySchema.safeParse({ note: 'confirm please' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shouldPurchaseInsurance).toBe(false);
    }
  });

  it('parses a complete insurance purchase and normalizes the details', () => {
    const result = confirmOrderBodySchema.safeParse(validDevice);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shouldPurchaseInsurance).toBe(true);
      expect(result.data.deviceDetails?.imei).toBe('123456789012345');
    }
  });

  it('rejects an incomplete insurance purchase (imei present, KYC missing)', () => {
    const result = confirmOrderBodySchema.safeParse({
      imei: '123456789012345',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when only device photos are supplied without the rest', () => {
    const result = confirmOrderBodySchema.safeParse({
      devicePhotos: { about: 'https://cdn.usebaci.com/orders/device.jpg' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a partial payload that carries only a KYC field (no imei/photos)', () => {
    // gender/dateOfBirth/deviceValue alone must not slip through as a plain
    // confirm — they signal an (incomplete) insurance purchase.
    expect(confirmOrderBodySchema.safeParse({ gender: 'Male' }).success).toBe(
      false
    );
    expect(
      confirmOrderBodySchema.safeParse({ dateOfBirth: '1995-04-12' }).success
    ).toBe(false);
    expect(
      confirmOrderBodySchema.safeParse({ deviceValue: 1_200_000 }).success
    ).toBe(false);
  });

  it('rejects a non-object body', () => {
    expect(confirmOrderBodySchema.safeParse(null).success).toBe(false);
    expect(confirmOrderBodySchema.safeParse('confirm').success).toBe(false);
  });
});
