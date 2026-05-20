import { describe, expect, it } from '@jest/globals';
import { withAlpha } from './withAlpha';

describe('withAlpha', () => {
  it('converts 3-digit hex colors with and without a leading hash', () => {
    expect(withAlpha('#f00', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(withAlpha('abc', 0.25)).toBe('rgba(170, 187, 204, 0.25)');
  });

  it('converts 6-digit hex colors with case-insensitive parsing', () => {
    expect(withAlpha('#ff0000', 0.4)).toBe('rgba(255, 0, 0, 0.4)');
    expect(withAlpha('ABCDEF', 0.75)).toBe('rgba(171, 205, 239, 0.75)');
  });

  it('ignores source alpha from 8-digit hex colors', () => {
    expect(withAlpha('#ff000080', 0.3)).toBe('rgba(255, 0, 0, 0.3)');
  });

  it('replaces alpha on rgb and rgba strings', () => {
    expect(withAlpha('rgb(10, 20, 30)', 0.2)).toBe('rgba(10, 20, 30, 0.2)');
    expect(withAlpha(' rgb(10, 20, 30) ', 0.2)).toBe(
      'rgba(10, 20, 30, 0.2)'
    );
    expect(withAlpha('rgba(10, 20, 30, 0.9)', 0.6)).toBe(
      'rgba(10, 20, 30, 0.6)'
    );
  });

  it('clamps alpha values to the supported range', () => {
    expect(withAlpha('#000', -1)).toBe('rgba(0, 0, 0, 0)');
    expect(withAlpha('#000', 2)).toBe('rgba(0, 0, 0, 1)');
  });

  it('returns unsupported color formats unchanged', () => {
    expect(withAlpha('red', 0.5)).toBe('red');
    expect(withAlpha('hsl(0, 100%, 50%)', 0.5)).toBe('hsl(0, 100%, 50%)');
    expect(withAlpha('rgb(100% 0% 0%)', 0.5)).toBe('rgb(100% 0% 0%)');
  });

  it('returns malformed colors unchanged', () => {
    expect(withAlpha('#ggg', 0.5)).toBe('#ggg');
    expect(withAlpha('rgb(999, 1, 1)', 0.5)).toBe('rgb(999, 1, 1)');
  });
});
