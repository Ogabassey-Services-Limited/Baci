import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const PUBLIC_ASSETS = [
  'african-santa-head.svg',
  'apple-touch-icon.png',
  'baci-verified-favicon.svg',
  'baci-logo-dark.svg',
  'baci-logo.svg',
  'badges/app-store-black.svg',
  'badges/google-play.svg',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'manifest.json',
  'placeholder.png',
  'placeholder.svg',
  'template-previews/ogabassey-v2.png',
] as const;

/** Exact public files referenced by released storefront browser output. */
export const STOREFRONT_EDGE_PUBLIC_ASSET_ROWS = PUBLIC_ASSETS.map((asset) => ({
  decision: 'edge_release',
  id: `public-asset:${asset}`,
  methods: ['GET', 'HEAD'],
  reason: 'storefront_referenced_public_asset',
  routePattern: `/${asset}`,
  sourceKind: 'public_asset',
  sourcePath: `apps/web/public/${asset}`,
})) satisfies readonly InventoryRow[];
