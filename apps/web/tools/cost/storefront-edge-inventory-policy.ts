import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';
import { STOREFRONT_EDGE_MACHINE_ROWS } from './storefront-edge-machine-rows';
import { STOREFRONT_EDGE_PROXY_ROWS } from './storefront-edge-proxy-rows';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const API_TERMINAL_ROW: InventoryRow = {
  decision: 'edge_terminal',
  id: 'api:unlisted',
  methods: ['ANY'],
  reason: 'closed_api_inventory_default',
  routePattern: '/api/{*unlisted}',
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
    API_TERMINAL_ROW,
    ...DRAFT_MODE_ROWS,
    ...STOREFRONT_EDGE_MACHINE_ROWS,
    ...SERVER_ACTION_ROWS,
    ...STOREFRONT_EDGE_PROXY_ROWS,
  ],
  routingInputPaths: [
    'next.config.ts',
    'apps/web/src/app/0751d5c882ab3d7c013ecbfe9e624d71.txt/route.ts',
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
  schemaVersion: 2,
} as const satisfies {
  completeBrowserPathClasses: readonly string[];
  eligibleDenominatorPolicy: StorefrontEdgeInventory['eligibleDenominatorPolicy'];
  extraRows: readonly InventoryRow[];
  routingInputPaths: readonly string[];
  schemaVersion: 2;
};
