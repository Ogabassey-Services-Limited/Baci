import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';
import { createStorefrontEdgeProxyClass } from './storefront-edge-proxy-class';
import { STOREFRONT_EDGE_PROXY_HOST_ROWS } from './storefront-edge-proxy-host-rows';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const proxyClass = createStorefrontEdgeProxyClass;

/** Closed directional classes mirrored from the current storefront proxy. */
export const STOREFRONT_EDGE_PROXY_ROWS: readonly InventoryRow[] = [
  proxyClass(
    'proxy:auth-confirm',
    '/auth/confirm',
    ['GET', 'HEAD'],
    'origin_dynamic',
    'custom_domain_auth_confirmation',
    {
      hostCondition: {
        hostKind: 'custom_domain',
        precedence: 'before_path_decision',
      },
      sourcePath: 'apps/web/src/app/auth/confirm/route.ts',
    }
  ),
  proxyClass(
    'proxy:markdown-mirror',
    '/{*storefrontMarkdownPath}.md',
    ['GET', 'HEAD'],
    'origin_dynamic',
    'storefront_markdown_api_rewrite'
  ),
  proxyClass(
    'proxy:blog-query-canonical',
    '/blog/{*path?}?{legacyThumbnailQuery}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'canonical_blog_query_normalization',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'legacy_blog_thumbnail_query',
      },
    }
  ),
  proxyClass(
    'proxy:blog-category-canonical',
    '/blog/{legacyCategory}/{legacyPostSlug}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'legacy_blog_category_permalink_redirect',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'legacy_blog_category_permalink',
      },
    }
  ),
  proxyClass(
    'proxy:cache-safe-punctuation',
    '/{*importedPunctuationPath}',
    ['ANY'],
    'edge_redirect',
    'cache_safe_storefront_path_normalization',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'cache_safe_imported_punctuation',
      },
    }
  ),
  proxyClass(
    'proxy:legacy-analytics-conversion',
    '/analytics/conversion',
    ['POST'],
    'origin_dynamic',
    'legacy_api_rewrite_preserves_mutation',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'legacy_analytics_conversion',
      },
    }
  ),
  proxyClass(
    'proxy:legacy-klump-webhook',
    '/wc-api/klp_wc_payment_webhook',
    ['ANY'],
    'edge_terminal',
    'retired_webhook_returns_410',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'legacy_klump_webhook_normalized',
      },
    }
  ),
  proxyClass(
    'proxy:legacy-terms-alias',
    '/terms-and-conditions',
    ['GET', 'HEAD'],
    'edge_redirect',
    'canonical_terms_alias'
  ),
  proxyClass(
    'proxy:legacy-terms-of-service',
    '/terms-of-service',
    ['GET', 'HEAD'],
    'edge_redirect',
    'canonical_terms_alias'
  ),
  proxyClass(
    'proxy:lowercase-document',
    '/{*mixedCaseDocument}',
    ['ANY'],
    'edge_redirect',
    'lowercase_storefront_canonicalization',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'mixed_case_path',
      },
    }
  ),
  proxyClass(
    'proxy:no-trailing-slash',
    '/{*document}/',
    ['ANY'],
    'edge_redirect',
    'trailing_slash_canonicalization',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'trailing_slash_excluding_well_known',
      },
    }
  ),
  proxyClass(
    'proxy:product-canonical',
    '/{category}/{productSlug}?{noncanonicalVariant}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'canonical_product_route_or_variant',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'noncanonical_product_route_or_variant',
      },
    }
  ),
  proxyClass(
    'proxy:redundant-slug-prefix',
    '/{currentSlug}/{*path?}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'custom_domain_slug_prefix_canonicalization',
    {
      hostCondition: {
        hostKind: 'custom_domain',
        precedence: 'before_path_decision',
      },
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'redundant_storefront_slug_prefix',
      },
    }
  ),
  proxyClass(
    'proxy:current-slug-api',
    '/{currentSlug}/api/{*path}',
    ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
    'origin_dynamic',
    'current_slug_api_rewrite_preserves_body',
    {
      hostCondition: {
        hostKind: 'custom_domain',
        precedence: 'before_path_decision',
      },
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'current_storefront_slug_api',
      },
    }
  ),
  proxyClass(
    'proxy:retired-slug-api',
    '/{retiredSlug}/api/{*path?}',
    ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
    'origin_dynamic',
    'alias_aware_api_rewrite_preserves_body',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'retired_storefront_slug_prefix',
      },
    }
  ),
  proxyClass(
    'proxy:retired-slug-document',
    '/{retiredSlug}/{*path}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'retired_storefront_alias_redirect',
    {
      hostCondition: {
        hostKind: 'custom_domain',
        precedence: 'before_path_decision',
      },
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'retired_storefront_slug_prefix',
      },
    }
  ),
  proxyClass(
    'proxy:root-sitemap',
    '/sitemap.xml',
    ['GET', 'HEAD'],
    'edge_release',
    'storefront_root_sitemap_rewrite'
  ),
  ...STOREFRONT_EDGE_PROXY_HOST_ROWS,
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
    'unsafe_or_ambiguous_storefront_path',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'unsafe_or_ambiguous_path',
      },
    }
  ),
  proxyClass(
    'proxy:unsupported-method',
    '/{*path}',
    ['OTHER'],
    'edge_terminal',
    'closed_method_inventory_default'
  ),
];
