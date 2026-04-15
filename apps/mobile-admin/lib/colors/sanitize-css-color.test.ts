import { describe, expect, it } from 'vitest';
import {
  getTranslucentColor,
  isValidCssColor,
  sanitizeCssColor,
} from '@/lib/colors/sanitize-css-color';

describe('sanitize-css-color', () => {
  it('accepts the supported CSS color formats', () => {
    expect(isValidCssColor('#3B82F6')).toBe(true);
    expect(isValidCssColor('rgba(59, 130, 246, 0.2)')).toBe(true);
    expect(isValidCssColor('hsl(217, 91%, 60%)')).toBe(true);
    expect(isValidCssColor('white')).toBe(true);
  });

  it('rejects unsupported and malicious CSS values', () => {
    expect(isValidCssColor('')).toBe(false);
    expect(isValidCssColor('banana')).toBe(false);
    expect(isValidCssColor('not-a-color')).toBe(false);
    expect(isValidCssColor('expression(alert(1))')).toBe(false);
    expect(isValidCssColor('var(--accent)')).toBe(false);
  });

  it('returns valid CSS colors unchanged', () => {
    expect(sanitizeCssColor('#123abc', '#000000')).toBe('#123abc');
    expect(sanitizeCssColor('red', '#000000')).toBe('red');
    expect(sanitizeCssColor('rgb(10, 20, 30)', '#000000')).toBe(
      'rgb(10, 20, 30)'
    );
  });

  it('falls back for unsupported CSS values', () => {
    expect(sanitizeCssColor('url(javascript:alert(1))', '#000000')).toBe(
      '#000000'
    );
  });

  it('derives translucent colors from hex values', () => {
    expect(
      getTranslucentColor('#3B82F6', 'rgba(59, 130, 246, 0.16)', 0.2)
    ).toBe('rgba(59, 130, 246, 0.2)');
  });

  it('returns the fallback when translucent colors cannot be derived', () => {
    expect(getTranslucentColor('not-a-color', 'rgba(0, 0, 0, 0)', 0.2)).toBe(
      'rgba(0, 0, 0, 0)'
    );
  });
});
