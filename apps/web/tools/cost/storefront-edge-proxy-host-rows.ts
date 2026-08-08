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
});

/** Host-conditioned proxy classes that must precede storefront resolution. */
export const STOREFRONT_EDGE_PROXY_HOST_ROWS: readonly InventoryRow[] = [
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
          'auth',
          'admin',
          'builder',
          'dashboard',
          'forgot-password',
          'login',
          'onboarding',
          'reset-password',
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
    'proxy:retired-slug-host',
    '/{*storefrontPath?}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'retired_storefront_alias_redirect',
    {
      hostCondition: {
        hostKind: 'retired_platform_subdomain_alias',
        precedence: 'before_path_decision',
      },
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'retired_alias_storefront_path',
      },
    }
  ),
  proxyClass(
    'proxy:custom-domain-platform-route',
    '/{platformRoutePrefix}/{*path?}',
    ['ANY'],
    'origin_dynamic',
    'custom_domain_platform_route_preserved',
    {
      hostCondition: {
        hostKind: 'custom_domain',
        precedence: 'before_path_decision',
      },
      pathCondition: {
        firstSegmentIn: [
          'auth',
          'admin',
          'builder',
          'dashboard',
          'forgot-password',
          'login',
          'onboarding',
          'reset-password',
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
    '/{*storefrontPath?}',
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
];
