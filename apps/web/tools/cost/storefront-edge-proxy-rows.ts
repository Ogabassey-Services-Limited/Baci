import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const proxyClass = (
  id: string,
  routePattern: string,
  methods: InventoryRow['methods'],
  decision: InventoryRow['decision'],
  reason: string,
  options: Readonly<{
    hostCondition?: InventoryRow['hostCondition'];
    pathCondition?: InventoryRow['pathCondition'];
    sourcePath?: string;
  }> = {}
): InventoryRow => ({
  decision,
  id,
  methods,
  reason,
  routePattern,
  sourceKind: 'proxy_path_class',
  ...(options.hostCondition ? { hostCondition: options.hostCondition } : {}),
  ...(options.pathCondition ? { pathCondition: options.pathCondition } : {}),
  ...(options.sourcePath ? { sourcePath: options.sourcePath } : {}),
});

/** Closed directional classes mirrored from the current storefront proxy. */
export const STOREFRONT_EDGE_PROXY_ROWS: readonly InventoryRow[] = [
  proxyClass(
    'proxy:auth-confirm',
    '/auth/confirm',
    ['GET', 'HEAD'],
    'origin_dynamic',
    'custom_domain_auth_confirmation',
    { sourcePath: 'apps/web/src/app/auth/confirm/route.ts' }
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
    '/blog/{*path}?{legacyThumbnailQuery}',
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
    'proxy:cache-safe-punctuation',
    '/{*importedPunctuationPath}',
    ['GET', 'HEAD'],
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
    ['GET', 'HEAD'],
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
    ['GET', 'HEAD'],
    'edge_redirect',
    'trailing_slash_canonicalization',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'trailing_slash',
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
    '/{currentSlug}/{*path}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'custom_domain_slug_prefix_canonicalization',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'redundant_storefront_slug_prefix',
      },
    }
  ),
  proxyClass(
    'proxy:retired-slug-api',
    '/{retiredSlug}/api/{*path}',
    ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'],
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
  proxyClass(
    'proxy:platform-route-subdomain',
    '/{platformRoutePrefix}/{*path?}',
    ['ANY'],
    'edge_redirect',
    'platform_route_subdomain_redirect',
    {
      hostCondition: {
        hostKind: 'platform_subdomain',
        precedence: 'before_path_decision',
      },
      pathCondition: {
        firstSegmentIn: [
          '_next',
          'auth',
          'builder',
          'dashboard',
          'forgot-password',
          'login',
          'manifest.webmanifest',
          'onboarding',
          'reset-password',
          'robots.txt',
          'signup',
          'staff',
          'update-password',
          'verify',
        ],
        precedence: 'before_path_decision',
        predicate: 'first_segment_allowlist',
      },
    }
  ),
  proxyClass(
    'proxy:subdomain-custom-domain',
    '/{*storefrontPath}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'canonical_custom_domain_redirect',
    {
      hostCondition: {
        hostKind: 'platform_subdomain',
        precedence: 'before_path_decision',
        requiresActiveCanonicalCustomDomain: true,
      },
    }
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
