import { describe, expect, it } from 'vitest';
import { extractComparableKeySpecs } from './comparable-key-specs';

describe('extractComparableKeySpecs', () => {
  it('returns a plain spec record unchanged', () => {
    const specs = { ram_gb: 16, storage_gb: 512 };

    expect(extractComparableKeySpecs(specs)).toEqual(specs);
  });

  it('unwraps the first record from a relation array payload', () => {
    expect(
      extractComparableKeySpecs([null, { chipset: 'A19 Pro' }, { ram_gb: 8 }])
    ).toEqual({ chipset: 'A19 Pro' });
  });

  it('returns null for an empty relation array', () => {
    expect(extractComparableKeySpecs([])).toBeNull();
  });

  it.each([
    [null],
    [undefined],
    ['specs'],
    [42],
  ])('returns null for non-record payload %s', (value) => {
    expect(extractComparableKeySpecs(value)).toBeNull();
  });
});
