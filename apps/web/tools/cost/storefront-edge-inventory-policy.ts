import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';
import { STOREFRONT_EDGE_MACHINE_ROWS } from './storefront-edge-machine-rows';
import { STOREFRONT_EDGE_MACHINE_SOURCE_PATHS } from './storefront-edge-machine-source-paths';
import { STOREFRONT_EDGE_PROXY_ROWS } from './storefront-edge-proxy-rows';
import { STOREFRONT_EDGE_PUBLIC_ASSET_ROWS } from './storefront-edge-public-asset-rows';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const STOREFRONT_ROUTE_SOURCE_PREFIX = 'apps/web/src/app/(storefront)/[slug]/';

const API_TERMINAL_ROW: InventoryRow = {
  decision: 'edge_terminal',
  id: 'api:unlisted',
  methods: ['ANY'],
  reason: 'closed_api_inventory_default',
  routePattern: '/api/{*unlisted?}',
  sourceKind: 'api_family',
};

const DRAFT_MODE_ROWS: readonly InventoryRow[] = ['/blog', '/blog/{*path}'].map(
  (routePattern, index) => ({
    decision: 'origin_dynamic',
    id: `request-override:draft-mode-${index === 0 ? 'root' : 'nested'}`,
    methods: ['GET', 'HEAD'],
    reason: 'next_draft_mode_cookie_requires_origin',
    requestCondition: {
      anyCookiePresent: ['__next_preview_data', '__prerender_bypass'],
      precedence: 'before_path_decision',
    },
    routePattern,
    sourceKind: 'request_override',
  })
);

const ROUTER_DATA_ROWS: readonly InventoryRow[] = [
  {
    decision: 'origin_dynamic',
    id: 'request-override:router-data',
    methods: ['GET', 'HEAD'],
    reason: 'next_router_data_requires_origin',
    requestCondition: {
      anyHeaderMatch: [
        { name: 'rsc', value: '1' },
        { name: 'next-router-prefetch' },
        { name: 'next-router-state-tree' },
      ],
      matchedStorefrontEntrypointDecision: 'edge_release',
      precedence: 'after_entrypoint_resolution_before_decision',
    },
    routePattern: '/{*storefrontPath?}',
    sourceKind: 'request_override',
    sourcePath: 'apps/web/src/lib/storefront-document-navigation.ts',
  },
];

const MARKDOWN_NEGOTIATION_ROWS: readonly InventoryRow[] = [
  '/',
  '/{storefrontIdentifier}',
].map((routePattern, index) => ({
  decision: 'origin_dynamic',
  id: `request-override:markdown-negotiation-${index === 0 ? 'root' : 'storefront'}`,
  methods: ['GET', 'HEAD'],
  reason: 'next_markdown_content_negotiation_rewrite',
  requestCondition: {
    anyHeaderMatch: [{ name: 'accept', value: 'text/markdown' }],
    precedence: 'before_path_decision',
  },
  routePattern,
  sourceKind: 'request_override',
  sourcePath: 'next.config.ts',
}));

const QUERY_DEPENDENT_ENTRYPOINTS = [
  {
    id: 'blog-root',
    routePattern: '/blog',
    sourcePath: 'apps/web/src/app/(storefront)/[slug]/(blog)/blog/page.tsx',
  },
  {
    id: 'blog-author',
    routePattern: '/blog/author/{authorSlug}',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(blog)/blog/author/[authorSlug]/page.tsx',
  },
  {
    id: 'blog-category',
    routePattern: '/blog/category/{categorySlug}',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(blog)/blog/category/[categorySlug]/page.tsx',
  },
  {
    id: 'compare-root',
    routePattern: '/compare',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/compare/page.tsx',
  },
  {
    id: 'category-root',
    routePattern: '/{category}',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/page.tsx',
  },
  {
    id: 'category-compare',
    routePattern: '/{category}/compare',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/page.tsx',
  },
  {
    id: 'products-root',
    routePattern: '/products',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/products/page.tsx',
  },
  {
    id: 'product-categoryless',
    routePattern: '/products/{productSlug}',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/page.tsx',
  },
  {
    id: 'product-category',
    routePattern: '/{category}/{productSlug}',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx',
  },
] as const;

const QUERY_DEPENDENT_ROWS: readonly InventoryRow[] =
  QUERY_DEPENDENT_ENTRYPOINTS.map(({ id, routePattern, sourcePath }) => {
    if (!sourcePath.startsWith(STOREFRONT_ROUTE_SOURCE_PREFIX))
      throw new Error(
        `query-dependent entrypoint is outside the storefront route root: ${sourcePath}`
      );
    return {
      decision: 'origin_dynamic',
      id: `request-override:query-dependent-${id}`,
      methods: ['GET', 'HEAD'],
      reason: 'query_dependent_storefront_render',
      requestCondition: {
        anyQueryKeyPresent: [
          'brand',
          'brands',
          'color',
          'colors',
          'condition',
          'displaySize',
          'displayType',
          'maxPrice',
          'minPrice',
          'page',
          'q',
          'query',
          'ram',
          'search',
          'simType',
          'storage',
          'variantId',
          'variant_id',
        ],
        matchedStorefrontEntrypointId: `storefront:${sourcePath.slice(
          STOREFRONT_ROUTE_SOURCE_PREFIX.length
        )}`,
        precedence: 'after_entrypoint_resolution_before_decision',
      },
      routePattern,
      sourceKind: 'request_override',
      sourcePath,
    };
  });

const SERVER_ACTION_ROWS: readonly InventoryRow[] = [
  {
    decision: 'origin_dynamic',
    id: 'server-action:blog-post-view-count',
    methods: ['POST'],
    reason: 'explicit_storefront_server_action',
    routePattern: '/blog/{postSlug}',
    sourceKind: 'server_action',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/actions.ts',
  },
  {
    decision: 'origin_dynamic',
    id: 'server-action:repair-booking',
    methods: ['POST'],
    reason: 'explicit_storefront_server_action',
    routePattern: '/repair',
    sourceKind: 'server_action',
    sourcePath: 'apps/web/src/app/actions/repair.ts',
  },
];

/** Reviewed, provider-independent policy inputs for the Task 1A inventory. */
export const STOREFRONT_EDGE_INVENTORY_POLICY = {
  completeBrowserPathClasses: [
    'automatic_origin_forbidden',
    'automatic_subresource',
    'client_island',
    'cold_document',
    'explicit_user_action',
    'warm_document',
  ],
  eligibleDenominatorPolicy: {
    decisions: ['edge_redirect', 'edge_release'],
    methods: ['GET', 'HEAD'],
    scope: 'approved_pilot_hosts_and_complete_browser_automatic_traffic',
    zeroDenominatorVerdict: 'NOT_PROVEN',
  },
  extraRows: [
    API_TERMINAL_ROW,
    ...DRAFT_MODE_ROWS,
    ...ROUTER_DATA_ROWS,
    ...MARKDOWN_NEGOTIATION_ROWS,
    ...QUERY_DEPENDENT_ROWS,
    ...STOREFRONT_EDGE_MACHINE_ROWS,
    ...STOREFRONT_EDGE_PUBLIC_ASSET_ROWS,
    ...SERVER_ACTION_ROWS,
    ...STOREFRONT_EDGE_PROXY_ROWS,
  ],
  routingInputPaths: [
    'next.config.ts',
    'apps/web/src/app/actions/repair.ts',
    'apps/web/src/app/auth/confirm/route.ts',
    'apps/web/src/app/agent/auth/route.ts',
    'apps/web/src/app/agent/auth/[action]/route.ts',
    'apps/web/src/app/layout.tsx',
    'apps/web/src/app/root-dynamic-body.tsx',
    'apps/web/src/app/sitemap.ts',
    'apps/web/src/proxy.ts',
    'apps/web/src/components/analytics/deferred-platform-insights.tsx',
    'apps/web/src/components/analytics/posthog-client-bootstrap.tsx',
    'apps/web/src/components/analytics/posthog-pageview-tracker.tsx',
    'apps/web/src/components/analytics/web-vitals-reporter.tsx',
    'apps/web/src/components/storefront/ad-attribution-capture.tsx',
    'apps/web/src/components/storefront/deferred-page-view-tracker.tsx',
    'apps/web/src/components/storefront/RepairBookingWizard.tsx',
    'apps/web/src/config/storefront-agent-routes.ts',
    'apps/web/src/config/storefront-cache.ts',
    'apps/web/src/config/storefront-cdn-cache-control.ts',
    'apps/web/src/config/storefront-feed-routes.ts',
    'apps/web/src/config/storefront-metadata-cache-bots.ts',
    'apps/web/src/lib/domain-cache-simple.ts',
    'apps/web/src/lib/slug-alias-cache.ts',
    'apps/web/src/lib/storefront-blog-listing-status.ts',
    'apps/web/src/lib/storefront-blog-listing-verdict.ts',
    'apps/web/src/lib/storefront-blog-post-status.ts',
    'apps/web/src/lib/storefront-compare-hub-status.ts',
    'apps/web/src/lib/storefront-document-home-path-rules.ts',
    'apps/web/src/lib/storefront-document-home-path.ts',
    'apps/web/src/lib/storefront-document-navigation.ts',
    'apps/web/src/lib/storefront-path-prefix.ts',
    'apps/web/src/lib/storefront-pdp-first-segment-gate.ts',
    'apps/web/src/lib/storefront-product-canonical-redirect.ts',
    'apps/web/src/lib/storefront-pdp-canonical-path.ts',
    'apps/web/src/lib/normalize-storefront-category-slug.ts',
    'apps/web/src/lib/seo-utils.ts',
    'apps/web/src/lib/storefront-product-slug-membership.ts',
    'apps/web/src/lib/storefront-route-identifier.ts',
    'apps/web/src/lib/storefront-unsafe-pdp-segments.ts',
    'apps/web/src/lib/posthog/config.ts',
    ...new Set(Object.values(STOREFRONT_EDGE_MACHINE_SOURCE_PATHS)),
    ...STOREFRONT_EDGE_PUBLIC_ASSET_ROWS.map(({ sourcePath }) => sourcePath),
  ],
  schemaVersion: 5,
} as const satisfies {
  completeBrowserPathClasses: readonly string[];
  eligibleDenominatorPolicy: StorefrontEdgeInventory['eligibleDenominatorPolicy'];
  extraRows: readonly InventoryRow[];
  routingInputPaths: readonly string[];
  schemaVersion: 5;
};
