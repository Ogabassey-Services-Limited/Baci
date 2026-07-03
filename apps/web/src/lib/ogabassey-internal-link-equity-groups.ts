import { OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS } from '@/config/ogabassey-internal-link-equity';
import { getCachedProductCanonicalPaths } from '@/lib/cached-product-canonical-paths';
import { resolveInternalLinkEquityGroups } from '@/lib/resolve-internal-link-equity-groups';

const INTERNAL_LINK_EQUITY_PRODUCT_SLUGS =
  OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS.flatMap((group) =>
    group.productLinks.map((productLink) => productLink.productSlug)
  );

/**
 * Resolves the curated Ogabassey link-equity config into render-ready link
 * groups: literal hrefs pass through, product slugs resolve to their current
 * canonical paths, and slugs that no longer resolve are dropped.
 */
export async function getOgabasseyInternalLinkEquityGroups(merchantId: string) {
  const productPathsBySlug = await getCachedProductCanonicalPaths(
    merchantId,
    INTERNAL_LINK_EQUITY_PRODUCT_SLUGS
  );

  return resolveInternalLinkEquityGroups(
    OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS,
    productPathsBySlug
  );
}
