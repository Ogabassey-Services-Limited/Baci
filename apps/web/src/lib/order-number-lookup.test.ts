import { describe, expect, it } from 'vitest';
import { getOrderNumberLookupCandidates } from './order-number-lookup';

describe('getOrderNumberLookupCandidates', () => {
  it('normalizes modern order numbers for lookup', () => {
    expect(getOrderNumberLookupCandidates(' ord - 241204 - a7k3 - 2 ')).toEqual(
      ['ORD-241204-A7K3-2']
    );
  });

  it('adds a hashed fallback for legacy numeric order numbers', () => {
    expect(getOrderNumberLookupCandidates('00001234')).toEqual([
      '00001234',
      '#00001234',
    ]);
  });

  it('keeps legacy hashed order numbers searchable without the hash', () => {
    expect(getOrderNumberLookupCandidates('#00001234')).toEqual([
      '#00001234',
      '00001234',
    ]);
  });
});
