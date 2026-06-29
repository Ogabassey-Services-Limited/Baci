import { describe, expect, it } from 'vitest';
import {
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
