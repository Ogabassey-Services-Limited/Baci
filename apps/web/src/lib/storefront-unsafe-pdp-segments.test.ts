import { describe, expect, it } from 'vitest';
import { hasUnsafeStorefrontPdpSegments } from '@/lib/storefront-unsafe-pdp-segments';

describe('hasUnsafeStorefrontPdpSegments', () => {
  it('recognizes unsafe PDP segments but leaves reserved route shapes alone', () => {
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
    expect(unsafeCategory).toBe(true);
    expect(reservedRoute).toBe(false);
  });
});
