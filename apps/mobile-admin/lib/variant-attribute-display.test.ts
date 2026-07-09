import { describe, expect, it } from 'vitest';
import type { VariantAttributeFormValue } from '@/lib/product-variant-form';
import {
  getPairedMetaAttributeIndexes,
  getVariantSwatch,
  isColorAttributeKey,
  isMetaAttributeKey,
  partitionVariantAttributes,
} from './variant-attribute-display';

function attribute(
  key: string,
  value: string,
  id = `${key}-${value}`
): VariantAttributeFormValue {
  return { id, key, value };
}

describe('isMetaAttributeKey', () => {
  it('flags color_hex and any *_hex key', () => {
    expect(isMetaAttributeKey('color_hex')).toBe(true);
    expect(isMetaAttributeKey('Colour_Hex')).toBe(true);
    expect(isMetaAttributeKey('accent_hex')).toBe(true);
  });

  it('does not flag human attribute keys', () => {
    expect(isMetaAttributeKey('color')).toBe(false);
    expect(isMetaAttributeKey('storage')).toBe(false);
  });
});

describe('isColorAttributeKey', () => {
  it('matches color and colour case-insensitively', () => {
    expect(isColorAttributeKey('Color')).toBe(true);
    expect(isColorAttributeKey('colour')).toBe(true);
    expect(isColorAttributeKey('size')).toBe(false);
  });
});

describe('getVariantSwatch', () => {
  it('prefers a valid hex from a *_hex attribute', () => {
    expect(
      getVariantSwatch([
        attribute('color', 'Black'),
        attribute('color_hex', '1C1C1C'),
      ])
    ).toBe('#1C1C1C');
  });

  it('passes through an already-prefixed hex', () => {
    expect(getVariantSwatch([attribute('color_hex', '#fff')])).toBe('#fff');
  });

  it('ignores unrelated hex metadata when choosing a swatch', () => {
    const attributes = [
      attribute('finish_hex', '#111111'),
      attribute('color_hex', '#000000'),
      attribute('color', 'Black'),
    ];

    expect(getVariantSwatch(attributes)).toBe('#000000');
  });

  it('falls back to a renderable named colour when there is no hex', () => {
    expect(getVariantSwatch([attribute('color', 'Red')])).toBe('red');
  });

  it('returns null for multi-word marketing colour names', () => {
    expect(getVariantSwatch([attribute('color', 'Space Black')])).toBeNull();
    expect(getVariantSwatch([attribute('color', 'Rose Gold')])).toBeNull();
  });

  it('returns null for unknown single-word colour names', () => {
    expect(getVariantSwatch([attribute('color', 'Graphite')])).toBeNull();
  });

  it('returns null when there is no colour information', () => {
    expect(getVariantSwatch([attribute('storage', '128GB')])).toBeNull();
  });

  it('ignores invalid hex values', () => {
    expect(getVariantSwatch([attribute('color_hex', 'not-a-hex')])).toBeNull();
  });
});

describe('getPairedMetaAttributeIndexes', () => {
  it('returns the color_hex index paired with a colour attribute', () => {
    const attributes = [
      attribute('color', 'Black'),
      attribute('color_hex', '#000000'),
      attribute('storage', '128GB'),
    ];
    expect(getPairedMetaAttributeIndexes(attributes, 0)).toEqual([1]);
  });

  it('does not pair unrelated hex metadata with the removed colour', () => {
    const attributes = [
      attribute('color', 'Black'),
      attribute('color_hex', '#000000'),
      attribute('finish', 'Matte'),
      attribute('finish_hex', '#111111'),
    ];

    expect(getPairedMetaAttributeIndexes(attributes, 0)).toEqual([1]);
  });

  it('returns nothing for a non-colour attribute', () => {
    const attributes = [
      attribute('color', 'Black'),
      attribute('color_hex', '#000000'),
      attribute('storage', '128GB'),
    ];
    expect(getPairedMetaAttributeIndexes(attributes, 2)).toEqual([]);
  });

  it('returns nothing when a colour has no paired hex', () => {
    expect(
      getPairedMetaAttributeIndexes([attribute('color', 'Black')], 0)
    ).toEqual([]);
  });
});

describe('partitionVariantAttributes', () => {
  it('splits visible and meta attributes while preserving real indexes', () => {
    const attributes = [
      attribute('color', 'Black'),
      attribute('color_hex', '#000'),
      attribute('storage', '128GB'),
    ];

    const { visible, meta } = partitionVariantAttributes(attributes);

    expect(visible.map((entry) => entry.index)).toEqual([0, 2]);
    expect(visible.map((entry) => entry.attribute.key)).toEqual([
      'color',
      'storage',
    ]);
    expect(meta.map((entry) => entry.index)).toEqual([1]);
  });
});
