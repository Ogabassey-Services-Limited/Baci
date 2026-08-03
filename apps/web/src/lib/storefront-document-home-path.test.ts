import { describe, expect, it } from 'vitest';
import { getStorefrontDocumentHomePath } from '@/lib/storefront-document-home-path';
import type { StorefrontDocumentHomePathRules } from '@/lib/storefront-document-home-path-rules';

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

describe('getStorefrontDocumentHomePath', () => {
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
});
