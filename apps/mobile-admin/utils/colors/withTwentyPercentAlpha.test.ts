import { describe, expect, it } from 'vitest';
import { withTwentyPercentAlpha } from './withTwentyPercentAlpha';

describe('withTwentyPercentAlpha', () => {
  it('adds 20 percent alpha to short hex colors', () => {
    expect(withTwentyPercentAlpha('#abc')).toBe('#aabbcc33');
  });

  it('adds 20 percent alpha to long hex colors', () => {
    expect(withTwentyPercentAlpha('#112233')).toBe('#11223333');
    expect(withTwentyPercentAlpha('#112233ff')).toBe('#11223333');
  });

  it('converts rgb colors to rgba with 0.2 alpha', () => {
    expect(withTwentyPercentAlpha('rgb(10, 20, 30)')).toBe('rgba(10, 20, 30, 0.2)');
    expect(withTwentyPercentAlpha('rgba(10, 20, 30, 0.4)')).toBe(
      'rgba(10, 20, 30, 0.2)'
    );
  });

  it('returns original value for unsupported color formats', () => {
    expect(withTwentyPercentAlpha('blue')).toBe('blue');
  });
});
