import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';
import { STOREFRONT_EDGE_MACHINE_ROWS } from './storefront-edge-machine-rows';
import { STOREFRONT_EDGE_MACHINE_SOURCE_PATHS } from './storefront-edge-machine-source-paths';
import { STOREFRONT_EDGE_MEDIA_SUBRESOURCE_ROWS } from './storefront-edge-media-subresource-rows';
import { STOREFRONT_EDGE_PROXY_ROWS } from './storefront-edge-proxy-rows';
import {
  STOREFRONT_EDGE_PLATFORM_ROOT_FAVICON_ROW,
  STOREFRONT_EDGE_PUBLIC_ASSET_ROWS,
} from './storefront-edge-public-asset-rows';
import { STOREFRONT_EDGE_QUERY_DEPENDENT_ROWS } from './storefront-edge-query-dependent-rows';
import { STOREFRONT_EDGE_ROUTING_INPUT_PATHS } from './storefront-edge-routing-input-paths';
import { STOREFRONT_EDGE_SUPABASE_SUBRESOURCE_ROWS } from './storefront-edge-supabase-subresource-rows';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const API_TERMINAL_ROW: InventoryRow = {
  decision: 'edge_terminal',
  id: 'api:unlisted',
  methods: ['ANY'],
  reason: 'closed_api_inventory_default',
  routePattern: '/api/{*unlisted?}',
  sourceKind: 'api_family',
};

const DRAFT_MODE_ROWS: readonly InventoryRow[] = [
  '/blog',
  '/blog/{*path}',
  '/{storefrontIdentifier}/blog',
  '/{storefrontIdentifier}/blog/{*path}',
].map<InventoryRow>((routePattern, index) => {
  const scope = ['root', 'nested', 'slug-root', 'slug-nested'][index];
  if (!scope) throw new Error('draft-mode path has no stable identifier');
  const row = {
    decision: 'origin_dynamic',
    id: `request-override:draft-mode-${scope}`,
    methods: ['GET', 'HEAD'],
    reason: 'next_draft_mode_cookie_requires_origin',
    requestCondition: {
      anyCookiePresent: ['__next_preview_data', '__prerender_bypass'],
      precedence: 'before_path_decision',
    },
    routePattern,
    sourceKind: 'request_override',
    ...(index >= 2
      ? {
          hostCondition: {
            hostKind: 'platform_root_domain' as const,
            precedence: 'before_path_decision' as const,
          },
        }
      : {}),
  } satisfies InventoryRow;
  return row;
});

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

const AUTH_SESSION_ROWS: readonly InventoryRow[] = [
  {
    decision: 'origin_dynamic',
    id: 'request-override:storefront-auth-session',
    methods: ['GET', 'HEAD'],
    reason: 'storefront_auth_session_requires_origin',
    requestCondition: {
      anyOf: [
        { cookiePredicate: 'supabase_auth_session_hint' },
        { anyHeaderMatch: [{ name: 'authorization' }] },
        { anyHeaderMatch: [{ name: 'x-supabase-auth-token' }] },
      ],
      matchedStorefrontEntrypointDecision: 'edge_release',
      precedence: 'after_entrypoint_resolution_before_decision',
    },
    routePattern: '/{*storefrontPath?}',
    sourceKind: 'request_override',
    sourcePath: 'apps/web/src/proxy.ts',
  },
];

const LOCALE_SENSITIVE_ROWS: readonly InventoryRow[] = [
  {
    decision: 'origin_dynamic',
    id: 'request-override:blog-post-accept-language',
    methods: ['GET', 'HEAD'],
    reason: 'blog_post_locale_rendering',
    requestCondition: {
      anyHeaderMatch: [{ name: 'accept-language' }],
      matchedStorefrontEntrypointId:
        'storefront:(blog)/blog/[postSlug]/page.tsx',
      precedence: 'after_entrypoint_resolution_before_decision',
    },
    routePattern: '/blog/{postSlug}',
    sourceKind: 'request_override',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/page.tsx',
  },
  {
    decision: 'origin_dynamic',
    id: 'request-override:blog-post-accept-language-slug-prefixed',
    methods: ['GET', 'HEAD'],
    reason: 'blog_post_locale_rendering',
    requestCondition: {
      anyHeaderMatch: [{ name: 'accept-language' }],
      matchedStorefrontEntrypointId:
        'storefront:(blog)/blog/[postSlug]/page.tsx:slug-prefixed',
      precedence: 'after_entrypoint_resolution_before_decision',
    },
    routePattern: '/{storefrontIdentifier}/blog/{postSlug}',
    sourceKind: 'request_override',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/page.tsx',
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
  sourcePath: 'apps/web/next.config.ts',
}));

const SERVER_ACTION_ROWS: readonly InventoryRow[] = [
  {
    decision: 'origin_dynamic',
    id: 'server-action:blog-post-view-count',
    methods: ['POST'],
    reason: 'automatic_blog_view_count',
    requestCondition: {
      anyHeaderMatch: [{ name: 'next-action' }],
      precedence: 'before_path_decision',
    },
    routePattern: '/blog/{postSlug}',
    sourceKind: 'automatic_subresource',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/actions.ts',
  },
  {
    decision: 'origin_dynamic',
    id: 'server-action:blog-post-view-count-slug-prefixed',
    methods: ['POST'],
    reason: 'automatic_blog_view_count',
    requestCondition: {
      anyHeaderMatch: [{ name: 'next-action' }],
      precedence: 'before_path_decision',
    },
    routePattern: '/{storefrontIdentifier}/blog/{postSlug}',
    sourceKind: 'automatic_subresource',
    sourcePath:
      'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/actions.ts',
  },
  {
    decision: 'origin_dynamic',
    id: 'server-action:repair-booking',
    methods: ['POST'],
    reason: 'explicit_storefront_server_action',
    requestCondition: {
      anyHeaderMatch: [{ name: 'next-action' }],
      precedence: 'before_path_decision',
    },
    routePattern: '/repair',
    sourceKind: 'server_action',
    sourcePath: 'apps/web/src/app/actions/repair.ts',
  },
  {
    decision: 'origin_dynamic',
    id: 'server-action:repair-booking-slug-prefixed',
    methods: ['POST'],
    reason: 'explicit_storefront_server_action',
    requestCondition: {
      anyHeaderMatch: [{ name: 'next-action' }],
      precedence: 'before_path_decision',
    },
    routePattern: '/{storefrontIdentifier}/repair',
    hostCondition: {
      hostKind: 'platform_root_domain',
      precedence: 'before_path_decision',
    },
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
  apiTerminalRow: API_TERMINAL_ROW,
  extraRows: [
    ...DRAFT_MODE_ROWS,
    ...ROUTER_DATA_ROWS,
    ...AUTH_SESSION_ROWS,
    ...LOCALE_SENSITIVE_ROWS,
    ...MARKDOWN_NEGOTIATION_ROWS,
    ...STOREFRONT_EDGE_QUERY_DEPENDENT_ROWS,
    ...STOREFRONT_EDGE_MACHINE_ROWS,
    ...STOREFRONT_EDGE_PUBLIC_ASSET_ROWS,
    ...STOREFRONT_EDGE_SUPABASE_SUBRESOURCE_ROWS,
    ...STOREFRONT_EDGE_MEDIA_SUBRESOURCE_ROWS,
    STOREFRONT_EDGE_PLATFORM_ROOT_FAVICON_ROW,
    ...SERVER_ACTION_ROWS,
    ...STOREFRONT_EDGE_PROXY_ROWS,
  ],
  routingInputPaths: [
    ...STOREFRONT_EDGE_ROUTING_INPUT_PATHS,
    'apps/web/next.config.ts',
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
    'apps/web/src/components/storefront/puck-storefront.tsx',
    'apps/web/src/components/storefront/cdn-format-image.tsx',
    'apps/web/src/components/storefront/ogabassey/pages/about-us.tsx',
    'apps/web/src/components/analytics/analytics-pixel-provider.tsx',
    'apps/web/src/components/analytics/facebook-pixel.tsx',
    'apps/web/src/components/analytics/snapchat-pixel.tsx',
    'apps/web/src/components/analytics/twitter-pixel.tsx',
    'apps/web/src/components/analytics/google-analytics.tsx',
    'apps/web/src/components/analytics/tiktok-pixel.tsx',
    'apps/web/src/components/analytics/google-store-widget.tsx',
    'apps/web/src/components/analytics/google-customer-reviews.tsx',
    'apps/web/src/components/analytics/google-store-widget-utils.ts',
    'apps/web/src/components/storefront/ogabassey/components/negotiation-modal-request.ts',
    'apps/web/src/components/storefront/ogabassey/components/negotiation-evidence.ts',
    'apps/web/src/components/storefront/ogabassey/pages/bnpl-launcher.tsx',
    'apps/web/src/components/storefront/ogabassey/components/google-ad-bootstrap.ts',
    'apps/web/src/components/storefront/ogabassey/components/CartSidebar.tsx',
    'apps/web/src/components/storefront/ogabassey/components/BlogSnippet.tsx',
    'apps/web/src/components/storefront/ogabassey/components/chat/use-ogabassey-chat.ts',
    'apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx',
    'apps/web/src/components/storefront/checkout-identity-modal.tsx',
    'apps/web/src/components/storefront/checkout-auth-modal.tsx',
    'apps/web/src/components/storefront/ogabassey/components/CheckoutIdentityModal.tsx',
    'apps/web/src/components/storefront/ogabassey/pages/quiz-page-data.ts',
    'apps/web/src/components/storefront/new-template/checkout-page.tsx',
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
    'apps/web/src/lib/storefront-internal-preflight.ts',
    'apps/web/src/lib/storefront-preflight-rpc.ts',
    'apps/web/src/lib/storefront-slug-safety.ts',
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
    'apps/web/src/lib/google-places.ts',
    ...new Set(Object.values(STOREFRONT_EDGE_MACHINE_SOURCE_PATHS)),
    ...STOREFRONT_EDGE_PUBLIC_ASSET_ROWS.map(({ sourcePath }) => sourcePath),
    STOREFRONT_EDGE_PLATFORM_ROOT_FAVICON_ROW.sourcePath,
  ],
  schemaVersion: 6,
} as const satisfies {
  apiTerminalRow: InventoryRow;
  completeBrowserPathClasses: readonly string[];
  eligibleDenominatorPolicy: StorefrontEdgeInventory['eligibleDenominatorPolicy'];
  extraRows: readonly InventoryRow[];
  routingInputPaths: readonly string[];
  schemaVersion: 6;
};
