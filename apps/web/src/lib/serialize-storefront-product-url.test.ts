import { describe, expect, it } from 'vitest';
import { serializeStorefrontProductUrl } from './serialize-storefront-product-url';

describe('serializeStorefrontProductUrl', () => {
  it('preserves the origin while serializing the generated path', () => {
    expect(
      serializeStorefrontProductUrl('https://store.example/smart watches/watch')
    ).toBe('https://store.example/smart%20watches/watch');
  });
});
