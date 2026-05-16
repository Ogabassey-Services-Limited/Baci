import { describe, expect, it } from 'vitest';
import { calculateLoyaltyRedemption } from './commerce-loyalty-redemption';

describe('calculateLoyaltyRedemption', () => {
  it('rejects non-integer point amounts', () => {
    expect(
      calculateLoyaltyRedemption({ currentPoints: 250, points: '150.5' })
    ).toEqual({
      error: 'Invalid redemption amount',
      minRedeemPoints: 100,
      success: false,
    });
  });

  it('rejects non-plain numeric point inputs', () => {
    expect(
      calculateLoyaltyRedemption({ currentPoints: 250, points: '1e2' })
    ).toEqual({
      error: 'Invalid redemption amount',
      minRedeemPoints: 100,
      success: false,
    });
  });

  it('rejects unsafe point amounts', () => {
    expect(
      calculateLoyaltyRedemption({
        currentPoints: Number.MAX_SAFE_INTEGER + 1,
        points: Number.MAX_SAFE_INTEGER + 1,
      })
    ).toEqual({
      error: 'Invalid redemption amount',
      minRedeemPoints: 100,
      success: false,
    });
  });

  it('rejects redemption below 100 points', () => {
    expect(
      calculateLoyaltyRedemption({ currentPoints: 250, points: 50 })
    ).toEqual({
      error: 'Minimum redemption is 100 points',
      minRedeemPoints: 100,
      success: false,
    });
  });

  it('rejects redemption amounts outside 100-point blocks', () => {
    expect(
      calculateLoyaltyRedemption({ currentPoints: 250, points: 150 })
    ).toEqual({
      error: 'Redeem points in 100-point blocks',
      minRedeemPoints: 100,
      success: false,
    });
  });

  it('rejects redemption above the current point balance', () => {
    expect(
      calculateLoyaltyRedemption({ currentPoints: 100, points: 200 })
    ).toEqual({
      currentPoints: 100,
      error: 'Insufficient loyalty points',
      requestedPoints: 200,
      success: false,
    });
  });

  it('converts 100-point blocks to wallet credit at 1 point to 1 naira', () => {
    expect(
      calculateLoyaltyRedemption({
        currentPoints: 250,
        points: 200,
        pointsToNairaRate: 0.01,
      })
    ).toEqual({
      conversionRate: 1,
      pointsRedeemed: 200,
      remainingPoints: 50,
      success: true,
      walletCredit: 200,
    });
  });
});
