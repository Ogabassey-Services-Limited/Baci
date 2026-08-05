import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const proxyClass = (
  id: string,
  routePattern: string,
  methods: readonly string[],
  decision: InventoryRow['decision'],
  reason: string
): InventoryRow => ({
  decision,
  id,
  methods,
  reason,
  routePattern,
  sourceKind: 'proxy_path_class',
});

/** Closed directional classes mirrored from the current storefront proxy. */
export const STOREFRONT_EDGE_PROXY_ROWS: readonly InventoryRow[] = [
  proxyClass(
    'proxy:blog-query-canonical',
    '/blog/{*path}?{legacyThumbnailQuery}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'canonical_blog_query_normalization'
  ),
  proxyClass(
    'proxy:cache-safe-punctuation',
    '/{*importedPunctuationPath}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'cache_safe_storefront_path_normalization'
  ),
  proxyClass(
    'proxy:legacy-analytics-conversion',
    '/analytics/conversion',
    ['POST'],
    'origin_dynamic',
    'legacy_api_rewrite_preserves_mutation'
  ),
  proxyClass(
    'proxy:legacy-klump-webhook',
    '/wc-api/klp_wc_payment_webhook',
    ['ANY'],
    'edge_terminal',
    'retired_webhook_returns_410'
  ),
  proxyClass(
    'proxy:legacy-terms-alias',
    '/{terms-and-conditions|terms-of-service}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'canonical_terms_alias'
  ),
  proxyClass(
    'proxy:lowercase-document',
    '/{*mixedCaseDocument}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'lowercase_storefront_canonicalization'
  ),
  proxyClass(
    'proxy:no-trailing-slash',
    '/{*document}/',
    ['GET', 'HEAD'],
    'edge_redirect',
    'trailing_slash_canonicalization'
  ),
  proxyClass(
    'proxy:product-canonical',
    '/{category}/{productSlug}?{noncanonicalVariant}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'canonical_product_route_or_variant'
  ),
  proxyClass(
    'proxy:redundant-slug-prefix',
    '/{currentSlug}/{*path}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'custom_domain_slug_prefix_canonicalization'
  ),
  proxyClass(
    'proxy:retired-slug-api',
    '/{retiredSlug}/api/{*path}',
    ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'],
    'origin_dynamic',
    'alias_aware_api_rewrite_preserves_body'
  ),
  proxyClass(
    'proxy:retired-slug-document',
    '/{retiredSlug}/{*path}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'retired_storefront_alias_redirect'
  ),
  proxyClass(
    'proxy:root-sitemap',
    '/sitemap.xml',
    ['GET', 'HEAD'],
    'edge_release',
    'storefront_root_sitemap_rewrite'
  ),
  proxyClass(
    'proxy:subdomain-custom-domain',
    '/{*storefrontPath}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'canonical_custom_domain_redirect'
  ),
  proxyClass(
    'proxy:unknown-document',
    '/{*unlistedDocument}',
    ['GET', 'HEAD'],
    'edge_terminal',
    'closed_storefront_document_inventory_default'
  ),
  proxyClass(
    'proxy:unsafe-document',
    '/{*unsafeDocument}',
    ['GET', 'HEAD'],
    'edge_terminal',
    'unsafe_or_ambiguous_storefront_path'
  ),
  proxyClass(
    'proxy:unsupported-method',
    '/{*path}',
    ['OTHER'],
    'edge_terminal',
    'closed_method_inventory_default'
  ),
];
