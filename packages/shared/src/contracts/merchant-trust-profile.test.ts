import { describe, expect, it } from 'vitest';
import {
  TRUST_PROFILE_RETURN_FEES,
  TRUST_PROFILE_RETURN_METHODS,
  TRUST_PROFILE_SHIPPING_FEE_TYPES,
} from './merchant-trust-profile';

describe('merchant trust profile contract', () => {
  it('exports the supported return methods', () => {
    expect(TRUST_PROFILE_RETURN_METHODS).toEqual([
      'mail',
      'in_store',
      'carrier_dropoff',
    ]);
  });

  it('exports the supported return fee values', () => {
    expect(TRUST_PROFILE_RETURN_FEES).toEqual([
      'free',
      'customer_pays',
      'original_shipping_deducted',
    ]);
  });

  it('exports the supported shipping fee values', () => {
    expect(TRUST_PROFILE_SHIPPING_FEE_TYPES).toEqual([
      'free',
      'flat_rate',
      'calculated',
    ]);
  });

  it('does not duplicate values within any enum list', () => {
    expect(new Set(TRUST_PROFILE_RETURN_METHODS).size).toBe(
      TRUST_PROFILE_RETURN_METHODS.length
    );
    expect(new Set(TRUST_PROFILE_RETURN_FEES).size).toBe(
      TRUST_PROFILE_RETURN_FEES.length
    );
    expect(new Set(TRUST_PROFILE_SHIPPING_FEE_TYPES).size).toBe(
      TRUST_PROFILE_SHIPPING_FEE_TYPES.length
    );
  });
});
