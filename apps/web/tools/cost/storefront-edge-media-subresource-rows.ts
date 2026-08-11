import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const mediaSubresource = (
  id: string,
  hostKind:
    | 'configured_media_cdn_origin'
    | 'configured_external_media_origin'
    | 'configured_supabase_storage_origin',
  sourcePath = 'apps/web/src/components/storefront/cdn-format-image.tsx'
): InventoryRow => ({
  decision: 'origin_dynamic',
  destinationCondition: {
    hostKind,
    precedence: 'before_path_decision',
  },
  id: `automatic-subresource:${id}`,
  methods: ['GET', 'HEAD'],
  reason: 'browser_external_media_request',
  routePattern: '/{*externalMediaPath?}',
  sourceKind: 'automatic_subresource',
  sourcePath,
});

/** External image destinations emitted by released storefront components. */
export const STOREFRONT_EDGE_MEDIA_SUBRESOURCE_ROWS: readonly InventoryRow[] = [
  mediaSubresource('media-cdn', 'configured_media_cdn_origin'),
  mediaSubresource('supabase-storage', 'configured_supabase_storage_origin'),
  mediaSubresource(
    'transparent-textures',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/ogabassey/pages/about-us.tsx'
  ),
];
