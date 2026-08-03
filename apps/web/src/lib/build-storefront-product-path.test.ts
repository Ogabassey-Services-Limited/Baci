import { describe, expect, it } from 'vitest';
import { buildStorefrontProductPath } from './build-storefront-product-path';

describe('buildStorefrontProductPath', () => {
  it('preserves the stored category slug while serializing each segment', () => {
    expect(buildStorefrontProductPath('watch?gps', null, 'smart watches')).toBe(
      '/smart%20watches/watch%3Fgps'
    );
  });
});
