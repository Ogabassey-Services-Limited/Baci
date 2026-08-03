import { describe, expect, it } from 'vitest';
import { hasUnsafeStorefrontPdpSegments } from '@/lib/storefront-unsafe-pdp-segments';

describe('hasUnsafeStorefrontPdpSegments', () => {
  it('rejects unsafe product slugs but leaves unsafe categories and reserved routes to canonical routing', () => {
    // Arrange
    const unsafeSlug = `phone${'%2525252525'.repeat(30)}`;
    const nonCacheableFirstSegments = new Set(['account']);

    // Act
    const unsafePdp = hasUnsafeStorefrontPdpSegments(
      ['smartphones', unsafeSlug],
      nonCacheableFirstSegments
    );
    const unsafeCategory = hasUnsafeStorefrontPdpSegments(
      [unsafeSlug, 'phone'],
      nonCacheableFirstSegments
    );
    const reservedRoute = hasUnsafeStorefrontPdpSegments(
      ['account', unsafeSlug],
      nonCacheableFirstSegments
    );

    // Assert
    expect(unsafePdp).toBe(true);
    expect(unsafeCategory).toBe(false);
    expect(reservedRoute).toBe(false);
  });
});
