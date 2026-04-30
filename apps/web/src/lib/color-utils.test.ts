import { describe, expect, it } from 'vitest';
import { hexToRgba } from '@/lib/color-utils';

describe('hexToRgba', () => {
  it('converts hex colors to rgba with a clamped alpha channel', () => {
    expect(hexToRgba('#ffffff', 0.24)).toBe('rgba(255, 255, 255, 0.24)');
    expect(hexToRgba('#abc', 2)).toBe('rgba(170, 187, 204, 1)');
    expect(hexToRgba('#000000', -1)).toBe('rgba(0, 0, 0, 0)');
    expect(hexToRgba('#000000', Number.NaN)).toBe('rgba(0, 0, 0, 1)');
  });

  it('returns the original value when a color cannot be parsed', () => {
    expect(hexToRgba('not-a-color', 0.24)).toBe('not-a-color');
    expect(hexToRgba('#gggggg', 0.24)).toBe('#gggggg');
  });
});
