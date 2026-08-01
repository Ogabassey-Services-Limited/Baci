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

  it('removes consecutive connectivity markers before sim', () => {
    const tokens = normalizeProductModelTokens([
      'samsung',
      's22',
      'ultra',
      'dual',
      'physical',
      'sim',
    ]);

    expect(tokens).toEqual(['samsung', 's22', 'ultra']);
  });

  it('removes a decimal display size and its suffix markers', () => {
    const tokens = normalizeProductModelTokens([
      'dell',
      'xps',
      '15',
      '9560',
      '15',
      '6',
      '4k',
      'touchscreen',
    ]);

    expect(tokens).toEqual(['dell', 'xps', '15', '9560']);
  });

  it('removes a decimal FHD display size from laptop model tokens', () => {
    const tokens = normalizeProductModelTokens([
      'dell',
      'precision',
      '5540',
      '15',
      '6',
      'fhd',
      'non',
      'touch',
    ]);

    expect(tokens).toEqual(['dell', 'precision', '5540']);
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

  it('removes a hyphenated e-sim suffix', () => {
    const tokens = normalizeProductModelTokens([
      'iphone',
      '14',
      'pro',
      'e',
      'sim',
    ]);

    expect(tokens).toEqual(['iphone', '14', 'pro']);
  });
});
