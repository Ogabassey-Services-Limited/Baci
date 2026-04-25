import { describe, expect, it } from '@jest/globals';
import {
  INTERNAL_SELECTION_AXIS_VALUES,
  isInternalSelectionAxis,
  stripInternalSelectionAxes,
} from '@/lib/product-internal-selection-axes';

describe('product-internal-selection-axes', () => {
  it('recognizes every internal selection axis', () => {
    for (const axis of INTERNAL_SELECTION_AXIS_VALUES) {
      expect(isInternalSelectionAxis(axis)).toBe(true);
    }
  });

  it('rejects non-internal selection axes', () => {
    expect(isInternalSelectionAxis('size')).toBe(false);
    expect(isInternalSelectionAxis('weight')).toBe(false);
    expect(isInternalSelectionAxis('COLOR')).toBe(false);
    expect(isInternalSelectionAxis('Color')).toBe(false);
    expect(isInternalSelectionAxis(' color ')).toBe(false);
    expect(isInternalSelectionAxis(null)).toBe(false);
    expect(isInternalSelectionAxis(undefined)).toBe(false);
    expect(isInternalSelectionAxis(123)).toBe(false);
    expect(isInternalSelectionAxis({ axis: 'color' })).toBe(false);
  });

  it('removes internal axes and preserves merchant-facing attributes', () => {
    expect(
      stripInternalSelectionAxes({
        color: 'Gold',
        colour_hex: '#F5D4A3',
        storage: '64GB',
        warranty: '12 months',
        network: 'Unlocked',
      })
    ).toEqual({
      network: 'Unlocked',
      warranty: '12 months',
    });
  });

  it('returns an empty object for empty attributes', () => {
    expect(stripInternalSelectionAxes({})).toEqual({});
  });

  it('returns an empty object for nullish attributes', () => {
    expect(stripInternalSelectionAxes(null)).toEqual({});
    expect(stripInternalSelectionAxes(undefined)).toEqual({});
  });

  it('preserves merchant attributes with complex values', () => {
    const features = ['Face ID', 'Dual SIM'];
    const warranty = { months: 12 };

    expect(
      stripInternalSelectionAxes({
        color: 'Gold',
        storage: '256GB',
        bundle: features,
        warranty,
        network: 'Unlocked',
      })
    ).toEqual({
      bundle: features,
      network: 'Unlocked',
      warranty,
    });
  });

  it('handles large attribute objects without dropping merchant-facing keys', () => {
    const attributes = Object.fromEntries(
      Array.from({ length: 50 }, (_, index) => [`merchant_${index}`, index])
    );

    expect(
      stripInternalSelectionAxes({
        ...attributes,
        color_hex: '#C0C0C0',
        colour: 'Silver',
      })
    ).toEqual(attributes);
  });
});
