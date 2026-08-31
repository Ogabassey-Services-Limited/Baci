import { describe, expect, it } from 'vitest';
import { isValidPublicProductCanonicalPath } from './is-valid-public-product-canonical-path';

describe('isValidPublicProductCanonicalPath', () => {
  it.each([
    ['/phones/phone', true],
    ['/products/phone', true],
  ])('accepts supported PDP shape %s', (path, expected) => {
    expect(isValidPublicProductCanonicalPath(path, 'phone')).toBe(expected);
  });

  it.each([
    '/about',
    '/phones/another-product',
    '/missing/category/phone',
    '/products/phone/extra',
    '/api/phone',
    '/phones.v2/phone',
  ])('rejects non-PDP canonical path %s', (path) => {
    expect(isValidPublicProductCanonicalPath(path, 'phone')).toBe(false);
  });
});
