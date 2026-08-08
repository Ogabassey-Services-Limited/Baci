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
const RELAY_PATH_PATTERN = /^\/[a-z0-9]+(?:[-/][a-z0-9]+)*$/;

function normalizeRelayPath(value: string) {
  const trimmed = value.trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '') || DEFAULT_RELAY_PATH;
  if (!RELAY_PATH_PATTERN.test(normalized))
    throw new Error(`posthog relay path is not canonical: ${value}`);
  if (
    RESERVED_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    )
  )
    throw new Error(`posthog relay path uses a reserved prefix: ${normalized}`);
  return normalized;
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
