import { describe, expect, it } from 'vitest';
import { isValidStorefrontCanonicalUrl } from './is-valid-storefront-canonical-url';

describe('isValidStorefrontCanonicalUrl', () => {
  it('accepts absolute HTTP URLs and rejects unsafe or relative values', () => {
    expect(
      isValidStorefrontCanonicalUrl('https://store.test/products/watch')
    ).toBe(true);
    expect(isValidStorefrontCanonicalUrl('javascript:alert(1)')).toBe(false);
    expect(isValidStorefrontCanonicalUrl('/products/watch')).toBe(false);
  });
});
