import { describe, expect, it } from 'vitest';
import { generateStorefrontProductSlug } from './generate-storefront-product-slug';

describe('generateStorefrontProductSlug', () => {
  it('removes a legacy condition suffix before generating the product slug', () => {
    expect(generateStorefrontProductSlug('Watch Pro (Used)')).toBe('watch-pro');
  });
});
