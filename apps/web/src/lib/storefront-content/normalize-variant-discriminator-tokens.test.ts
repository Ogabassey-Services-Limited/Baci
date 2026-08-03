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
});
