import { describe, expect, it } from 'vitest';
import {
  getStorefrontDocumentHomePath,
  getStorefrontPdpFirstSegmentGate,
  hasUnsafeStorefrontPdpSegments,
  isStorefrontDocumentNavigation,
  type StorefrontDocumentHomePathRules,
} from '@/lib/storefront-path-safety';

const rules: StorefrontDocumentHomePathRules = {
  isSlugPrefixedHost: (hostname) =>
    hostname === 'usebaci.com' || hostname === 'localhost:3000',
  extractMerchantSubdomain: (hostname) => {
    const match = hostname.match(/^([a-z0-9-]+)\.usebaci\.com$/);
    return match?.[1] ?? null;
  },
  extractLocalhostSubdomain: (hostname) => {
    const match = hostname.match(/^([a-z0-9-]+)\.localhost(?::\d+)?$/);
    return match?.[1] ?? null;
  },
  isValidCustomDomain: (hostname) => hostname === 'ogabassey.com',
  isValidMerchantSlug: (slug) => /^[a-z0-9-]+$/.test(slug),
  reservedSubdomains: new Set(['cdn', 'support']),
  platformRootRouteSegments: new Set(['api', 'products']),
};

describe('storefront path safety', () => {
  it('returns a slug-prefixed homepage for plain localhost storefront URLs', () => {
    // Arrange
    const pathname = '/ogabassey/smartphones/phone';

    // Act
    const homePath = getStorefrontDocumentHomePath(
      pathname,
      'localhost:3000',
      rules
    );

    // Assert
    expect(homePath).toBe('/ogabassey');
  });

  it('does not treat a reserved root-domain subdomain as a custom domain', () => {
    // Arrange
    const pathname = '/smartphones/phone';

    // Act
    const homePath = getStorefrontDocumentHomePath(
      pathname,
      'support.usebaci.com',
      rules
    );

    // Assert
    expect(homePath).toBeNull();
  });

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

  it('recognizes unsafe PDP segments but leaves reserved route shapes alone', () => {
    // Arrange
    const unsafeSlug = `phone${'%2525252525'.repeat(30)}`;
    const nonCacheableFirstSegments = new Set(['account']);

    // Act
    const unsafePdp = hasUnsafeStorefrontPdpSegments(
      ['smartphones', unsafeSlug],
      nonCacheableFirstSegments
    );
    const reservedRoute = hasUnsafeStorefrontPdpSegments(
      ['account', unsafeSlug],
      nonCacheableFirstSegments
    );

    // Assert
    expect(unsafePdp).toBe(true);
    expect(reservedRoute).toBe(false);
  });

  it('recognizes only document GET and HEAD requests as eligible for synthetic statuses', () => {
    // Arrange
    const documentHeaders = new Headers({ 'sec-fetch-dest': 'document' });
    const rscHeaders = new Headers({ rsc: '1' });
    const prefetchHeaders = new Headers({ 'next-router-prefetch': '1' });
    const routerStateHeaders = new Headers({
      'next-router-state-tree': '%5B%22%22%5D',
    });
    const imageHeaders = new Headers({ 'sec-fetch-dest': 'image' });

    // Act
    const documentNavigation = isStorefrontDocumentNavigation(
      'GET',
      documentHeaders
    );
    const rscNavigation = isStorefrontDocumentNavigation('GET', rscHeaders);
    const prefetchNavigation = isStorefrontDocumentNavigation(
      'GET',
      prefetchHeaders
    );
    const routerStateNavigation = isStorefrontDocumentNavigation(
      'GET',
      routerStateHeaders
    );
    const imageNavigation = isStorefrontDocumentNavigation('GET', imageHeaders);

    // Assert
    expect(documentNavigation).toBe(true);
    expect(rscNavigation).toBe(false);
    expect(prefetchNavigation).toBe(false);
    expect(routerStateNavigation).toBe(false);
    expect(imageNavigation).toBe(false);
    expect(isStorefrontDocumentNavigation('POST', documentHeaders)).toBe(false);
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
