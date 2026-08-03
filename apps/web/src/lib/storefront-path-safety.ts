import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';

export type StorefrontDocumentHomePathRules = {
  isSlugPrefixedHost: (hostname: string) => boolean;
  extractMerchantSubdomain: (hostname: string) => string | null;
  extractLocalhostSubdomain: (hostname: string) => string | null;
  isValidCustomDomain: (hostname: string) => boolean;
  isValidMerchantSlug: (slug: string) => boolean;
  reservedSubdomains: ReadonlySet<string>;
  platformRootRouteSegments: ReadonlySet<string>;
};

export type StorefrontPdpFirstSegmentGate = {
  firstSegment: string;
  isProductsFallbackPdp: boolean;
  isNonPdpFirstSegment: boolean;
};

/**
 * Decode a raw URL path segment for routing comparisons without letting a
 * malformed percent escape crash the proxy. A bad sequence falls back to its
 * original value so callers can preserve their fail-open behavior.
 */
function safeDecodeStorefrontPathSegment(segment: string | undefined): string {
  if (!segment) {
    return '';
  }

  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Finds the stable homepage path for a storefront document URL shape without
 * consulting tenant data. Reserved platform subdomains deliberately return
 * null: they are neither merchant subdomains nor custom domains.
 */
export function getStorefrontDocumentHomePath(
  pathname: string,
  hostname: string | undefined,
  rules: StorefrontDocumentHomePathRules
): string | null {
  const hostnameValue = hostname ?? '';
  const pathSegments = pathname.split('/').filter(Boolean);

  if (rules.isSlugPrefixedHost(hostnameValue)) {
    const merchantSlug = pathSegments[0]?.toLowerCase();
    if (
      !merchantSlug ||
      !rules.isValidMerchantSlug(merchantSlug) ||
      rules.reservedSubdomains.has(merchantSlug) ||
      rules.platformRootRouteSegments.has(merchantSlug)
    ) {
      return null;
    }

    return `/${merchantSlug}`;
  }

  const merchantSubdomain = rules.extractMerchantSubdomain(hostnameValue);
  if (merchantSubdomain) {
    return rules.reservedSubdomains.has(merchantSubdomain.toLowerCase())
      ? null
      : '/';
  }

  if (rules.extractLocalhostSubdomain(hostnameValue)) {
    return '/';
  }

  return rules.isValidCustomDomain(hostnameValue) ? '/' : null;
}

/**
 * Centralizes the PDP-category exception shared by the synchronous malformed
 * URL gate and the async crawl-budget preflight. `/products/{slug}` is a real
 * categoryless PDP; all other reserved/non-cacheable first segments are not.
 */
export function getStorefrontPdpFirstSegmentGate(
  contentSegments: readonly string[],
  nonCacheableFirstSegments: ReadonlySet<string>
): StorefrontPdpFirstSegmentGate {
  const firstSegment = safeDecodeStorefrontPathSegment(
    contentSegments[0]
  ).toLowerCase();
  const isProductsFallbackPdp = firstSegment === 'products';

  return {
    firstSegment,
    isProductsFallbackPdp,
    isNonPdpFirstSegment:
      !isProductsFallbackPdp &&
      (!firstSegment || nonCacheableFirstSegments.has(firstSegment)),
  };
}

/**
 * Only full-document GET/HEAD navigations can receive a synthetic HTML status.
 * Router data and prefetch requests must keep flowing to Next's normal route
 * handling, which produces the response shape its client router expects.
 */
export function isStorefrontDocumentNavigation(
  method: string,
  headers: Headers
): boolean {
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }

  if (
    headers.get('rsc') === '1' ||
    headers.has('next-router-prefetch') ||
    headers.has('next-router-state-tree')
  ) {
    return false;
  }

  const fetchDest = headers.get('sec-fetch-dest')?.toLowerCase();
  return !fetchDest || fetchDest === 'document';
}

/**
 * Returns true only for the exact two-segment PDP shape whose category is a
 * PDP-capable segment and whose category or product slug is unsafe to forward
 * into routing, cache, and product-lookup work.
 */
export function hasUnsafeStorefrontPdpSegments(
  contentSegments: readonly string[],
  nonCacheableFirstSegments: ReadonlySet<string>
): boolean {
  if (contentSegments.length !== 2) {
    return false;
  }

  if (
    getStorefrontPdpFirstSegmentGate(contentSegments, nonCacheableFirstSegments)
      .isNonPdpFirstSegment
  ) {
    return false;
  }

  return contentSegments.some(
    (segment) => !evaluateStorefrontSlugSafety(segment).safe
  );
}
