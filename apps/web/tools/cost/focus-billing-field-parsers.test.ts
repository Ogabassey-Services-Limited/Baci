import { describe, expect, it } from 'vitest';
import { finiteNonnegative } from './finite-nonnegative';
import { finiteSigned } from './finite-signed';
import { dateString } from './focus-billing-date-string';

describe('FOCUS billing field parsers', () => {
  it('normalizes valid charge-period timestamps', () => {
    expect(dateString('2026-08-01T00:00:00.000Z', 'ChargePeriodStart')).toBe(
      '2026-08-01T00:00:00.000Z'
    );
  });

  it('rejects invalid quantities and costs', () => {
    expect(() => finiteNonnegative(-1, 'ConsumedQuantity')).toThrow(
      'billing row has an invalid ConsumedQuantity'
    );
    expect(() => finiteSigned(Number.NaN, 'EffectiveCost')).toThrow(
      'billing row has an invalid EffectiveCost'
    );
  });
});
