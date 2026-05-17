import { describe, expect, it } from 'vitest';
import {
  calculateVtuAirtimeLoyaltyPoints,
  getRedeemablePointBalance,
  isRedeemablePointAmount,
} from './vtu-loyalty-points';

describe('calculateVtuAirtimeLoyaltyPoints', () => {
  it('awards one point for every three naira of airtime cashback', () => {
    expect(
      calculateVtuAirtimeLoyaltyPoints({
        customerCashback: 15,
        transactionType: 'airtime',
      })
    ).toBe(5);
  });

  it('floors fractional point values', () => {
    expect(
      calculateVtuAirtimeLoyaltyPoints({
        customerCashback: 7.5,
        transactionType: 'airtime',
      })
    ).toBe(2);
  });

  it('does not award points for non-airtime VTU transactions', () => {
    expect(
      calculateVtuAirtimeLoyaltyPoints({
        customerCashback: 15,
        transactionType: 'data',
      })
    ).toBe(0);
  });

  it('returns zero for missing, negative, invalid, or unsafe cashback amounts', () => {
    expect(
      calculateVtuAirtimeLoyaltyPoints({
        customerCashback: null,
        transactionType: 'airtime',
      })
    ).toBe(0);
    expect(
      calculateVtuAirtimeLoyaltyPoints({
        customerCashback: -15,
        transactionType: 'airtime',
      })
    ).toBe(0);
    expect(
      calculateVtuAirtimeLoyaltyPoints({
        customerCashback: Number.NaN,
        transactionType: 'airtime',
      })
    ).toBe(0);
    expect(
      calculateVtuAirtimeLoyaltyPoints({
        customerCashback: Number.MAX_SAFE_INTEGER * 3,
        transactionType: 'airtime',
      })
    ).toBe(0);
  });
});

describe('isRedeemablePointAmount', () => {
  it('allows positive 100-point blocks', () => {
    expect(isRedeemablePointAmount(100)).toBe(true);
    expect(isRedeemablePointAmount(300)).toBe(true);
  });

  it('rejects partial, fractional, negative, and unsafe point amounts', () => {
    expect(isRedeemablePointAmount(99)).toBe(false);
    expect(isRedeemablePointAmount(150)).toBe(false);
    expect(isRedeemablePointAmount(100.5)).toBe(false);
    expect(isRedeemablePointAmount(-100)).toBe(false);
    expect(isRedeemablePointAmount(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });
});

describe('getRedeemablePointBalance', () => {
  it('rounds a balance down to the nearest 100-point block', () => {
    expect(getRedeemablePointBalance(250)).toBe(200);
  });

  it('returns zero when the balance has no redeemable block', () => {
    expect(getRedeemablePointBalance(99)).toBe(0);
    expect(getRedeemablePointBalance(0)).toBe(0);
    expect(getRedeemablePointBalance(Number.NaN)).toBe(0);
  });
});
