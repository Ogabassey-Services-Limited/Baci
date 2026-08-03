import { describe, expect, it } from 'vitest';
import { serializeStorefrontProductPath } from './serialize-storefront-product-path';

describe('serializeStorefrontProductPath', () => {
  it('serializes every generated path segment and removes trailing slashes', () => {
    expect(
      serializeStorefrontProductPath('/smart%20watches/watch?gps///')
    ).toBe('/smart%20watches/watch%3Fgps');
  });
});
