import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';
import { STOREFRONT_EDGE_MACHINE_ROWS } from './storefront-edge-machine-rows';
import { STOREFRONT_EDGE_PROXY_ROWS } from './storefront-edge-proxy-rows';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const dynamicFamily = (
  id: string,
  routePattern: string,
  methods: readonly string[]
): InventoryRow => ({
  decision: 'origin_dynamic',
  id,
  methods,
  reason: 'explicit_storefront_runtime_family',
  routePattern,
  sourceKind: 'api_family',
});

const API_ROWS: readonly InventoryRow[] = [
  dynamicFamily('api:agentic', '/api/agentic/{*path}', [
    'GET',
    'HEAD',
    'POST',
    'PUT',
  ]),
  dynamicFamily('api:ai', '/api/ai/{*path}', ['POST']),
  dynamicFamily('api:attribution', '/api/attr', ['POST']),
  dynamicFamily('api:blog', '/api/blog/{*path}', ['GET', 'HEAD', 'POST']),
  dynamicFamily('api:cart', '/api/cart/{*path}', ['POST']),
  dynamicFamily('api:chat', '/api/chat/{*path}', ['POST']),
  dynamicFamily('api:csrf', '/api/csrf', ['GET', 'HEAD']),
  dynamicFamily('api:data', '/api/data', ['GET', 'HEAD']),
  dynamicFamily('api:events', '/api/events', ['POST']),
  dynamicFamily('api:forms', '/api/forms/{*path}', ['POST']),
  dynamicFamily(
    'api:internal-storefront',
    '/api/internal/compare-hub-status/{identifier}',
    ['GET', 'HEAD']
  ),
  dynamicFamily('api:insurance', '/api/insurance/{*path}', ['GET', 'HEAD']),
  dynamicFamily('api:llm', '/api/llm/{*path}', ['GET', 'HEAD']),
  dynamicFamily('api:merchant-storefront-context', '/api/merchant/{*path}', [
    'GET',
    'HEAD',
  ]),
  dynamicFamily('api:newsletter', '/api/newsletter/subscribe', ['POST']),
  dynamicFamily('api:negotiations', '/api/negotiations/{*path}', ['POST']),
  dynamicFamily('api:notifications', '/api/notifications/{*path}', [
    'GET',
    'HEAD',
    'PATCH',
    'POST',
  ]),
  dynamicFamily('api:ogabassey', '/api/ogabassey/{*path}', ['GET', 'HEAD']),
  dynamicFamily('api:orders', '/api/orders/{*path}', [
    'GET',
    'HEAD',
    'PATCH',
    'POST',
  ]),
  dynamicFamily('api:payments', '/api/payments/{*path}', [
    'GET',
    'HEAD',
    'POST',
  ]),
  dynamicFamily('api:products', '/api/products/{*path}', ['GET', 'HEAD']),
  dynamicFamily('api:quiz', '/api/quiz/{*path}', [
    'GET',
    'HEAD',
    'POST',
    'PUT',
  ]),
  dynamicFamily('api:repairs', '/api/repairs/{*path}', [
    'GET',
    'HEAD',
    'PATCH',
  ]),
  dynamicFamily('api:reviews', '/api/reviews/{*path}', [
    'DELETE',
    'GET',
    'HEAD',
    'POST',
  ]),
  dynamicFamily('api:search', '/api/search/{*path}', ['GET', 'HEAD']),
  dynamicFamily('api:shipping', '/api/shipping/{*path}', [
    'GET',
    'HEAD',
    'POST',
  ]),
  dynamicFamily('api:storefront', '/api/storefront/{*path}', [
    'DELETE',
    'GET',
    'HEAD',
    'PATCH',
    'POST',
  ]),
  dynamicFamily('api:vtu', '/api/vtu/{*path}', ['GET', 'HEAD', 'POST']),
  dynamicFamily('api:wallet', '/api/wallet/{*path}', ['GET', 'HEAD', 'PATCH']),
  dynamicFamily('api:webhooks', '/api/webhooks/{*path}', ['POST']),
  dynamicFamily('api:wishlist', '/api/wishlist/{*path}', [
    'DELETE',
    'GET',
    'HEAD',
    'POST',
  ]),
  {
    decision: 'edge_terminal',
    id: 'api:unlisted',
    methods: ['ANY'],
    reason: 'closed_api_inventory_default',
    routePattern: '/api/{*unlisted}',
    sourceKind: 'api_family',
  },
];

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
    ...API_ROWS,
    ...STOREFRONT_EDGE_MACHINE_ROWS,
    ...SERVER_ACTION_ROWS,
    ...STOREFRONT_EDGE_PROXY_ROWS,
  ],
  routingInputPaths: [
    'next.config.ts',
    'apps/web/src/app/layout.tsx',
    'apps/web/src/app/root-dynamic-body.tsx',
    'apps/web/src/proxy.ts',
    'apps/web/src/components/analytics/deferred-platform-insights.tsx',
    'apps/web/src/components/analytics/posthog-client-bootstrap.tsx',
    'apps/web/src/components/analytics/posthog-pageview-tracker.tsx',
    'apps/web/src/components/analytics/web-vitals-reporter.tsx',
    'apps/web/src/components/storefront/ad-attribution-capture.tsx',
    'apps/web/src/components/storefront/deferred-page-view-tracker.tsx',
    'apps/web/src/config/storefront-agent-routes.ts',
    'apps/web/src/config/storefront-cache.ts',
    'apps/web/src/config/storefront-cdn-cache-control.ts',
    'apps/web/src/config/storefront-feed-routes.ts',
    'apps/web/src/config/storefront-metadata-cache-bots.ts',
    'apps/web/src/lib/domain-cache-simple.ts',
    'apps/web/src/lib/slug-alias-cache.ts',
    'apps/web/src/lib/storefront-blog-listing-status.ts',
    'apps/web/src/lib/storefront-blog-post-status.ts',
    'apps/web/src/lib/storefront-compare-hub-status.ts',
    'apps/web/src/lib/storefront-document-home-path-rules.ts',
    'apps/web/src/lib/storefront-document-home-path.ts',
    'apps/web/src/lib/storefront-document-navigation.ts',
    'apps/web/src/lib/storefront-path-prefix.ts',
    'apps/web/src/lib/storefront-pdp-first-segment-gate.ts',
    'apps/web/src/lib/storefront-product-canonical-redirect.ts',
    'apps/web/src/lib/storefront-product-slug-membership.ts',
    'apps/web/src/lib/storefront-route-identifier.ts',
    'apps/web/src/lib/storefront-unsafe-pdp-segments.ts',
  ],
  schemaVersion: 1,
} as const satisfies {
  completeBrowserPathClasses: readonly string[];
  eligibleDenominatorPolicy: StorefrontEdgeInventory['eligibleDenominatorPolicy'];
  extraRows: readonly InventoryRow[];
  routingInputPaths: readonly string[];
  schemaVersion: 1;
};
