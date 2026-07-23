import { describe, expect, it } from 'vitest';
import { readStalePaidStartCharge } from './stale-paid-start-charge';

describe('readStalePaidStartCharge', () => {
  it('returns null for a free start, which is the only correct outcome', () => {
    const charge = readStalePaidStartCharge({
      attemptId: 'attempt-1',
      examPassPointsSpent: 0,
    });

    expect(charge).toBeNull();
  });

  it('flags a start that the stale paid RPC charged', () => {
    const charge = readStalePaidStartCharge({
      attemptId: 'attempt-1',
      examPassPointsSpent: 1,
      remainingLoyaltyPoints: 4,
    });

    expect(charge).toEqual({ attemptId: 'attempt-1', pointsSpent: 1 });
  });

  it('still flags the charge when the attempt id is unreadable', () => {
    const charge = readStalePaidStartCharge({ examPassPointsSpent: 2 });

    expect(charge).toEqual({ attemptId: null, pointsSpent: 2 });
  });

  it.each([
    ['null payload', null],
    ['non-object payload', 'nope'],
    ['missing field', { attemptId: 'attempt-1' }],
    ['non-numeric spend', { examPassPointsSpent: '1' }],
    ['negative spend', { examPassPointsSpent: -1 }],
    ['NaN spend', { examPassPointsSpent: Number.NaN }],
  ])('returns null for %s', (_label, payload) => {
    expect(readStalePaidStartCharge(payload)).toBeNull();
  });
});
