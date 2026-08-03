import { describe, expect, it } from 'vitest';
import { serializeStorefrontProductPathSegment } from './serialize-storefront-product-path-segment';

describe('serializeStorefrontProductPathSegment', () => {
  it('decodes before trimming and encoding a generated segment', () => {
    expect(serializeStorefrontProductPathSegment('%20watch%20')).toBe('watch');
  });

  it('encodes reserved delimiters without double encoding', () => {
    expect(serializeStorefrontProductPathSegment('watch?gps#v2')).toBe(
      'watch%3Fgps%23v2'
    );
    expect(serializeStorefrontProductPathSegment('watch%3Fgps%23v2')).toBe(
      'watch%3Fgps%23v2'
    );
  });
});
