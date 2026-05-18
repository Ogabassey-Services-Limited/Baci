import { describe, expect, it } from '@jest/globals';
import {
  contrastRatio,
  linearize,
  parseHexColor,
  relativeLuminance,
} from './wcagContrast';

describe('wcag contrast helpers', () => {
  it('parses supported hex colors and rejects unsupported formats', () => {
    expect(parseHexColor('#abc123')).toEqual({
      r: 0xab / 255,
      g: 0xc1 / 255,
      b: 0x23 / 255,
    });
    expect(() => parseHexColor('rgb(255,0,0)')).toThrow(
      'Unsupported contrast test color'
    );
    expect(() => parseHexColor('#fff')).toThrow(
      'Unsupported contrast test color'
    );
    expect(() => parseHexColor('#ffffff80')).toThrow(
      'Unsupported contrast test color'
    );
    expect(() => parseHexColor('red')).toThrow(
      'Unsupported contrast test color'
    );
  });

  it('uses the linear branch at the exact WCAG luminance threshold', () => {
    expect(linearize(0.03928)).toBeCloseTo(0.03928 / 12.92);
  });

  it('computes WCAG contrast helper values predictably', () => {
    expect(linearize(0.03929)).toBeCloseTo(((0.03929 + 0.055) / 1.055) ** 2.4);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1);
    expect(relativeLuminance('#000000')).toBeCloseTo(0);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
  });
});
