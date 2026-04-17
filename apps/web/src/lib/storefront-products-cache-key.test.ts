import { describe, expect, it } from 'vitest';
import { buildStorefrontProductsCacheKeyParts } from './storefront-products-cache-key';

describe('buildStorefrontProductsCacheKeyParts', () => {
  it('treats false like an unset has_images filter while keeping true distinct', () => {
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

    expect(unset).not.toContain('img-true');
    expect(disabled).not.toContain('img-true');
    expect(enabled).toContain('img-true');
    expect(disabled).toEqual(unset);
    expect(enabled).not.toEqual(unset);
    expect(enabled).not.toEqual(disabled);
  });
});
