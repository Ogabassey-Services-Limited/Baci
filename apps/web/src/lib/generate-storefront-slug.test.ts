import { describe, expect, it } from 'vitest';
import { generateStorefrontSlug } from './generate-storefront-slug';

describe('generateStorefrontSlug', () => {
  it('generates a normalized slug from merchant-authored text', () => {
    expect(generateStorefrontSlug('  Watch Pro + GPS  ')).toBe('watch-pro-gps');
  });
});
