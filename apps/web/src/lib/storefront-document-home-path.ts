import type { StorefrontDocumentHomePathRules } from '@/lib/storefront-document-home-path-rules';

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
