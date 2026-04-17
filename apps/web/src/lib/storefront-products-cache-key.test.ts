import { describe, expect, it } from 'vitest';
import { buildStorefrontProductsCacheKeyParts } from './storefront-products-cache-key';

describe('buildStorefrontProductsCacheKeyParts', () => {
  it('distinguishes false from undefined for has_images', () => {
    const unset = buildStorefrontProductsCacheKeyParts('merchant-1', {
      sort: 'newest',
    });
    const disabled = buildStorefrontProductsCacheKeyParts('merchant-1', {
      sort: 'newest',
      has_images: false,
    });
    const enabled = buildStorefrontProductsCacheKeyParts('merchant-1', {
      sort: 'newest',
      has_images: true,
    });

    expect(unset).not.toContain('img-false');
    expect(unset).not.toContain('img-true');
    expect(disabled).toContain('img-false');
    expect(enabled).toContain('img-true');
    expect(disabled).not.toEqual(unset);
    expect(enabled).not.toEqual(unset);
    expect(enabled).not.toEqual(disabled);
  });
});
