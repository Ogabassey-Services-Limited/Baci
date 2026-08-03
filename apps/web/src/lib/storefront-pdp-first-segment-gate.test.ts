import { describe, expect, it } from 'vitest';
import { getStorefrontPdpFirstSegmentGate } from '@/lib/storefront-pdp-first-segment-gate';

describe('getStorefrontPdpFirstSegmentGate', () => {
  it('keeps the categoryless products PDP eligible while excluding account paths', () => {
    // Arrange
    const nonCacheableFirstSegments = new Set(['account', 'products']);

    // Act
    const productsGate = getStorefrontPdpFirstSegmentGate(
      ['products', 'phone'],
      nonCacheableFirstSegments
    );
    const accountGate = getStorefrontPdpFirstSegmentGate(
      ['account', 'login'],
      nonCacheableFirstSegments
    );

    // Assert
    expect(productsGate).toMatchObject({
      firstSegment: 'products',
      isProductsFallbackPdp: true,
      isNonPdpFirstSegment: false,
    });
    expect(accountGate.isNonPdpFirstSegment).toBe(true);
  });

  it('keeps malformed percent escapes available for fail-open first-segment routing', () => {
    // Arrange
    const malformedSegment = 'phone%zz';

    // Act
    const gate = getStorefrontPdpFirstSegmentGate(
      [malformedSegment, 'case'],
      new Set()
    );

    // Assert
    expect(gate.firstSegment).toBe(malformedSegment);
  });
});
