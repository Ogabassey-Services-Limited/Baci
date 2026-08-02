import { describe, expect, it } from 'vitest';
import { normalizeSpecValueText } from './spec-value-normalization';

describe('normalizeSpecValueText', () => {
  it('strips markup and normalizes whitespace in text values', () => {
    expect(normalizeSpecValueText(' <strong>1080p</strong>   display ')).toBe(
      '1080p display'
    );
  });

  it('preserves finite numeric values and renders booleans as labels', () => {
    expect(normalizeSpecValueText(30)).toBe('30');
    expect(normalizeSpecValueText(true)).toBe('Yes');
    expect(normalizeSpecValueText(false)).toBe('No');
    expect(normalizeSpecValueText(Number.NaN)).toBe('');
  });
});
