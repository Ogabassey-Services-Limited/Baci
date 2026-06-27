import { describe, expect, it } from 'vitest';
import {
  isColorAxisKey,
  resolveVariantColorAxisKey,
} from './resolve-variant-color-axis-key';

describe('resolveVariantColorAxisKey', () => {
  it('returns the canonical color key when variants use color', () => {
    expect(
      resolveVariantColorAxisKey([{ attributes: { color: 'Red' } }], 'Red')
    ).toBe('color');
  });

  it('returns the legacy Colour alias when variants store color under Colour', () => {
    expect(
      resolveVariantColorAxisKey([{ attributes: { Colour: 'Red' } }], 'Red')
    ).toBe('Colour');
  });

  it('returns the lowercase colour alias', () => {
    expect(
      resolveVariantColorAxisKey([{ attributes: { colour: 'Red' } }], 'Red')
    ).toBe('colour');
  });

  it('prefers the canonical color key in mixed-alias catalogs', () => {
    expect(
      resolveVariantColorAxisKey(
        [{ attributes: { Colour: 'Red' } }, { attributes: { color: 'Red' } }],
        'Red'
      )
    ).toBe('color');
  });

  it('falls back to color when no variant carries the value', () => {
    expect(
      resolveVariantColorAxisKey([{ attributes: { color: 'Blue' } }], 'Red')
    ).toBe('color');
  });

  it('falls back to color when variants are missing', () => {
    expect(resolveVariantColorAxisKey(null, 'Red')).toBe('color');
    expect(resolveVariantColorAxisKey(undefined, '')).toBe('color');
  });

  it('identifies color-axis keys', () => {
    expect(isColorAxisKey('color')).toBe(true);
    expect(isColorAxisKey('Colour')).toBe(true);
    expect(isColorAxisKey('colour')).toBe(true);
    expect(isColorAxisKey('storage')).toBe(false);
  });
});
