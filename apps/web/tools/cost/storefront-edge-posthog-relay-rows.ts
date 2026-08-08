import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const DEFAULT_RELAY_PATH = '/baci-relay';
const RESERVED_PREFIXES = [
  '/api',
  '/_next',
  '/admin',
  '/auth',
  '/builder',
  '/checkout',
  '/dashboard',
  '/login',
  '/logout',
  '/track',
] as const;

function normalizeRelayPath(value: string) {
  const trimmed = value.trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '') || DEFAULT_RELAY_PATH;
  const lowercase = normalized.toLowerCase();
  return RESERVED_PREFIXES.some(
    (prefix) => lowercase === prefix || lowercase.startsWith(`${prefix}/`)
  )
    ? DEFAULT_RELAY_PATH
    : normalized;
}

/** Freezes the configured PostHog proxy root and children into the inventory. */
export function createStorefrontEdgePosthogRelayRows(
  configuredPath: string
): readonly InventoryRow[] {
  const relayPath = normalizeRelayPath(configuredPath);
  return [relayPath, `${relayPath}/{*path}`].flatMap(
    (routePattern, index): readonly InventoryRow[] => {
      const suffix = index === 0 ? 'root' : 'children';
      return [
        {
          decision: 'edge_redirect',
          hostCondition: {
            hostKind: 'platform_subdomain',
            precedence: 'before_path_decision',
          },
          id: `proxy:platform-subdomain-posthog-relay-${suffix}`,
          methods: ['GET', 'HEAD', 'POST'],
          reason: 'platform_route_subdomain_redirect',
          routePattern,
          sourceKind: 'proxy_path_class',
          sourcePath: 'apps/web/src/proxy.ts',
        },
        {
          decision: 'origin_dynamic',
          id: `machine:posthog-relay-${suffix}`,
          methods: ['GET', 'HEAD', 'POST'],
          reason: 'configured_posthog_relay',
          routePattern,
          sourceKind: 'machine_family',
          sourcePath: 'apps/web/src/proxy.ts',
        },
      ];
    }
  );
}
