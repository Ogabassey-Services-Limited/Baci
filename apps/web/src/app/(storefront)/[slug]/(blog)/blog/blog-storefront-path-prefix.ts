interface RequestHeaderReader {
  get(name: string): string | null;
}

interface StorefrontPathPrefixMerchant {
  slug: string;
  custom_domain?: string | null;
}

/**
 * Resolve the storefront base path used for blog listing hrefs and redirects.
 *
 * On its trusted branches `proxy.ts` strips any client-supplied copies of the
 * merchant-context headers and re-sets them from the resolved merchant (custom
 * domain -> `x-custom-domain`, subdomain -> `x-merchant-slug`). Some path-based
 * fall-through branches do not strip them, so the mere *presence* of a header
 * cannot be trusted. We therefore only treat the storefront as served at the
 * domain root (empty prefix) when a header actually matches THIS merchant — a
 * forged header on a path-based request can no longer drop the `/slug` prefix.
 */
export function getBlogStorefrontPathPrefix(
  headersList: RequestHeaderReader,
  merchant: StorefrontPathPrefixMerchant
): string {
  const requestMerchantSlug = headersList.get('x-merchant-slug');
  const requestCustomDomain = headersList.get('x-custom-domain')?.toLowerCase();
  const merchantCustomDomain = merchant.custom_domain?.toLowerCase();

  const servedAtDomainRoot =
    requestMerchantSlug === merchant.slug ||
    (requestCustomDomain != null &&
      requestCustomDomain.length > 0 &&
      requestCustomDomain === merchantCustomDomain);

  return servedAtDomainRoot ? '' : `/${merchant.slug}`;
}
