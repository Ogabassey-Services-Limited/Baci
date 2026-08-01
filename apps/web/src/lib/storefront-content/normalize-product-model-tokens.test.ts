import { describe, expect, it } from 'vitest';
import { normalizeProductModelTokens } from './normalize-product-model-tokens';

describe('normalizeProductModelTokens', () => {
  it('removes merchandising suffixes', () => {
    const tokens = normalizeProductModelTokens([
      'iphone',
      '13',
      'pro',
      '128gb',
      'premium',
      'used',
    ]);

    expect(tokens).toEqual(['iphone', '13', 'pro', '128gb']);
  });

  it('removes region suffixes', () => {
    const tokens = normalizeProductModelTokens(['iphone', 'x', '64gb', 'uk']);

    expect(tokens).toEqual(['iphone', 'x', '64gb']);
  });

  it('removes dual-sim connectivity wording', () => {
    const tokens = normalizeProductModelTokens([
      'tecno',
      'spark',
      'pro',
      'dual',
      'sim',
    ]);

    expect(tokens).toEqual(['tecno', 'spark', 'pro']);
  });

  it('removes the physical marker with an esim suffix', () => {
    const tokens = normalizeProductModelTokens([
      'iphone',
      '16',
      'pro',
      'physical',
      'esim',
      'new',
    ]);

    expect(tokens).toEqual(['iphone', '16', 'pro']);
  });
});
