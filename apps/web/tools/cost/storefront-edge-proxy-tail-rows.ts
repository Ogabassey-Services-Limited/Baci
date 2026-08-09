import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';
import { createStorefrontEdgeProxyClass } from './storefront-edge-proxy-class';
import { STOREFRONT_EDGE_PROXY_HOST_ROWS } from './storefront-edge-proxy-host-rows';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

/** Terminal and host-conditioned proxy classes after explicit rewrites. */
export const STOREFRONT_EDGE_PROXY_TAIL_ROWS: readonly InventoryRow[] = [
  createStorefrontEdgeProxyClass(
    'proxy:root-sitemap',
    '/sitemap.xml',
    ['GET', 'HEAD', 'OPTIONS'],
    'edge_release',
    'storefront_root_sitemap_rewrite',
    {
      hostCondition: {
        hostKind: 'custom_domain',
        precedence: 'before_path_decision',
      },
    }
  ),
  createStorefrontEdgeProxyClass(
    'proxy:subdomain-sitemap',
    '/sitemap.xml',
    ['GET', 'HEAD', 'OPTIONS'],
    'edge_release',
    'storefront_root_sitemap_rewrite',
    {
      hostCondition: {
        hostKind: 'platform_subdomain',
        precedence: 'before_path_decision',
      },
    }
  ),
  createStorefrontEdgeProxyClass(
    'proxy:platform-root-sitemap',
    '/sitemap.xml',
    ['GET', 'HEAD', 'OPTIONS'],
    'origin_dynamic',
    'platform_root_sitemap_dynamic',
    {
      hostCondition: {
        hostKind: 'platform_root_domain',
        precedence: 'before_path_decision',
      },
      sourcePath: 'apps/web/src/app/sitemap.ts',
    }
  ),
  ...STOREFRONT_EDGE_PROXY_HOST_ROWS,
  createStorefrontEdgeProxyClass(
    'proxy:unknown-document',
    '/{*unlistedDocument}',
    ['GET', 'HEAD'],
    'edge_terminal',
    'closed_storefront_document_inventory_default'
  ),
  createStorefrontEdgeProxyClass(
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
  createStorefrontEdgeProxyClass(
    'proxy:unsupported-method',
    '/{*path?}',
    ['ANY'],
    'edge_terminal',
    'closed_method_inventory_default'
  ),
];
