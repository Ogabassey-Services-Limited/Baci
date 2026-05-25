import { describe, expect, it } from '@jest/globals';
import {
  getRedeemPointValidationError,
  redemptionBalanceSnapshotKey,
} from './loyalty-redemption-utils';

describe('loyalty redemption utils', () => {
  it('builds a stable redemption balance snapshot key', () => {
    expect(
      redemptionBalanceSnapshotKey({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        points: 200,
      })
    ).toBe('customer-1|merchant-1|200');
  });

  it('keeps snapshot keys unambiguous when ids contain separators', () => {
    expect(
      redemptionBalanceSnapshotKey({
        customerId: 'customer:1',
        merchantId: 'merchant:1',
        points: 200,
      })
    ).toBe('customer%3A1|merchant%3A1|200');
  });

  it.each([
    [-100, 'Invalid redemption amount'],
    [0, 'Invalid redemption amount'],
    [50, 'Minimum redemption is 100 points'],
    [100.5, 'Invalid redemption amount'],
    [150, 'Redeem points in 100-point blocks'],
    [200, null],
    [Number.NaN, 'Invalid redemption amount'],
    [Number.POSITIVE_INFINITY, 'Invalid redemption amount'],
    [Number.MAX_SAFE_INTEGER + 1, 'Invalid redemption amount'],
  ])('validates %p redeemable points', (points, expectedError) => {
    expect(getRedeemPointValidationError(points)).toBe(expectedError);
  });
});
