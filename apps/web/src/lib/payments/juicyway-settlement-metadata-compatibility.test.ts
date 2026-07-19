import { describe, expect, it } from 'vitest';
import { shouldRequireJuicywaySettlementMetadata } from '@/lib/payments/juicyway-settlement-metadata-compatibility';

describe('shouldRequireJuicywaySettlementMetadata', () => {
  it('preserves legacy sessions created before settlement metadata shipped', () => {
    expect(
      shouldRequireJuicywaySettlementMetadata('2026-06-25T14:44:59.999Z')
    ).toBe(false);
  });

  it('requires metadata at and after the compatibility cutoff', () => {
    expect(
      shouldRequireJuicywaySettlementMetadata('2026-06-25T14:45:00.000Z')
    ).toBe(true);
  });

  it.each([
    undefined,
    null,
    'not-a-date',
    'June 25, 2026 14:44:59 UTC',
  ])('fails closed for an invalid creation time: %s', (createdAt) => {
    expect(shouldRequireJuicywaySettlementMetadata(createdAt)).toBe(true);
  });
});
