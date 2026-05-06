import { describe, expect, it } from 'vitest';

import { normalizeProductKeySpecs } from './product-key-specs-normalize';

describe('normalizeProductKeySpecs', () => {
  it('preserves scalar key-spec object fields', () => {
    expect(
      normalizeProductKeySpecs({
        chipset: 'A19 Pro',
        ram_gb: 8,
        has_5g: true,
        sensors: ['accelerometer'],
        notes: null,
      })
    ).toEqual({
      chipset: 'A19 Pro',
      ram_gb: 8,
      has_5g: true,
    });
  });

  it('flattens embedded relation arrays to the first key-spec row', () => {
    expect(
      normalizeProductKeySpecs([
        {
          screen_size_inches: 6.3,
          storage_gb: 256,
        },
      ])
    ).toEqual({
      screen_size_inches: 6.3,
      storage_gb: 256,
    });
  });

  it('returns null for empty relation arrays', () => {
    expect(normalizeProductKeySpecs([])).toBeNull();
  });
});
