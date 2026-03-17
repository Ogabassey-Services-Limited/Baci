/**
 * Build the canonical base URL for a merchant's storefront.
 * Used by the feed route to generate deterministic product links.
 */
export function buildMerchantBaseUrl(merchant: {
  slug: string;
  custom_domain?: string | null;
}): string {
  if (merchant.custom_domain) {
    const normalizedDomain = merchant.custom_domain
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^\/+|\/+$/g, '');

    if (normalizedDomain) {
      return `https://${normalizedDomain}`;
    }
  }

  const slug = merchant.slug?.trim();
  if (!slug) {
    throw new Error('Merchant slug is required to build storefront URL');
  }

  return `https://${slug}.baci.app`;
}
