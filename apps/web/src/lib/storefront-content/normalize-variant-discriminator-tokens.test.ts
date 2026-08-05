import { describe, expect, it } from 'vitest';
import { normalizeVariantDiscriminatorTokens } from './normalize-variant-discriminator-tokens';

describe('normalizeVariantDiscriminatorTokens', () => {
  it('joins split capacity units and hyphenated Wi-Fi tokens', () => {
    const tokens = normalizeVariantDiscriminatorTokens([
      'ipad',
      '128',
      'gb',
      'wi',
      'fi',
    ]);

    expect(tokens).toEqual(['ipad', '128gb', 'wifi']);
  });

  it('canonicalizes a hyphenated e-SIM marker', () => {
    const tokens = normalizeVariantDiscriminatorTokens([
      'iphone',
      '15',
      'e',
      'sim',
    ]);

    expect(tokens).toEqual(['iphone', '15', 'esim']);
  });

  it('joins a split decimal display dimension into one discriminator', () => {
    const tokens = normalizeVariantDiscriminatorTokens([
      'ipad',
      '12',
      '9',
      'inch',
    ]);

    expect(tokens).toEqual(['ipad', '12.9inch']);
  });
});
