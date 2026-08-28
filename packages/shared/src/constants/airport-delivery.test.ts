import { describe, expect, it } from 'vitest';
import {
  AIRPORT_DELIVERY_FEES,
  LEGACY_AIRPORT_DELIVERY_FEE,
} from './airport-delivery';

describe('AIRPORT_DELIVERY_FEES', () => {
  it('keeps the fixed delivery and pickup prices in one shared source', () => {
    expect(AIRPORT_DELIVERY_FEES).toEqual({
      delivery: 35_000,
      pickup: 20_000,
    });
  });
});

describe('LEGACY_AIRPORT_DELIVERY_FEE', () => {
  it('preserves the pre-metadata mobile delivery amount for compatibility checks', () => {
    expect(LEGACY_AIRPORT_DELIVERY_FEE).toBe(25_000);
  });
});
