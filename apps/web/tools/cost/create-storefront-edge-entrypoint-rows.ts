import { extractStorefrontRouteMethods } from './extract-storefront-route-methods';
import { STOREFRONT_EDGE_ENTRYPOINT_CLASSIFICATIONS } from './storefront-edge-entrypoint-classifications';
import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';
import { STOREFRONT_EDGE_REDIRECT_ENTRYPOINTS } from './storefront-edge-redirect-entrypoints';
import { normalizeStorefrontEdgeRouteSegment } from './storefront-edge-route-segment';

type InventoryRow = StorefrontEdgeInventory['rows'][number];
type SourceFile = Readonly<{ bytes: Buffer; sourcePath: string }>;

const METADATA_ROUTE_SUFFIXES = new Map<string, string>([
  ['apple-icon.ts', 'apple-icon'],
  ['apple-icon.tsx', 'apple-icon'],
  ['icon.ts', 'icon'],
  ['icon.tsx', 'icon'],
  ['manifest.ts', 'manifest.webmanifest'],
  ['manifest.tsx', 'manifest.webmanifest'],
  ['opengraph-image.ts', 'opengraph-image'],
  ['opengraph-image.tsx', 'opengraph-image'],
  ['robots.ts', 'robots.txt'],
  ['robots.tsx', 'robots.txt'],
  ['sitemap.ts', 'sitemap.xml'],
  ['sitemap.tsx', 'sitemap.xml'],
  ['twitter-image.ts', 'twitter-image'],
  ['twitter-image.tsx', 'twitter-image'],
]);
function entrypointFileName(relativeSourcePath: string) {
  return relativeSourcePath.split('/').at(-1) ?? '';
}

function isEntrypoint(relativeSourcePath: string) {
  const fileName = entrypointFileName(relativeSourcePath);
  return (
    fileName === 'page.tsx' ||
    fileName === 'route.ts' ||
    METADATA_ROUTE_SUFFIXES.has(fileName)
  );
}

function normalizeRoutePattern(relativeSourcePath: string) {
  const fileName = entrypointFileName(relativeSourcePath);
  const metadataSuffix = METADATA_ROUTE_SUFFIXES.get(fileName);
  const segments = relativeSourcePath
    .split('/')
    .slice(0, -1)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
    .map(normalizeStorefrontEdgeRouteSegment);
  if (metadataSuffix) segments.push(metadataSuffix);
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

function routeMethods(
  relativeSourcePath: string,
  source: string
): InventoryRow['methods'] {
  const fileName = entrypointFileName(relativeSourcePath);
  if (fileName === 'page.tsx' || METADATA_ROUTE_SUFFIXES.has(fileName))
    return ['GET', 'HEAD'];
  const methods = extractStorefrontRouteMethods(source);
  if (methods.length === 0)
    throw new Error(
      `storefront route handler exports no HTTP method: ${relativeSourcePath}`
    );
  return methods;
}

/** Builds closed route rows from source bytes already bound to origin/main. */
export function createStorefrontEdgeEntrypointRows(
  routeRoot: string,
  routeSources: readonly SourceFile[]
): InventoryRow[] {
  const prefix = `${routeRoot.replace(/\/$/, '')}/`;
  const entrypointSources = routeSources.filter(({ sourcePath }) => {
    if (!sourcePath.startsWith(prefix))
      throw new Error('storefront route source is outside the route root');
    return isEntrypoint(sourcePath.slice(prefix.length));
  });
  const discoveredEntrypoints = new Set(
    entrypointSources.map(({ sourcePath }) => sourcePath.slice(prefix.length))
  );
  for (const expected of STOREFRONT_EDGE_REDIRECT_ENTRYPOINTS) {
    if (!discoveredEntrypoints.has(expected))
      throw new Error(`redirect entrypoint no longer exists: ${expected}`);
  }
  for (const expected of STOREFRONT_EDGE_ENTRYPOINT_CLASSIFICATIONS.keys()) {
    if (!discoveredEntrypoints.has(expected))
      throw new Error(
        `classified storefront entrypoint no longer exists: ${expected}`
      );
  }
  return entrypointSources.flatMap(({ bytes, sourcePath }) => {
    const relativeSourcePath = sourcePath.slice(prefix.length);
    const classification =
      STOREFRONT_EDGE_ENTRYPOINT_CLASSIFICATIONS.get(relativeSourcePath);
    if (!classification)
      throw new Error(
        `storefront entrypoint has no reviewed classification: ${relativeSourcePath}`
      );
    const methods = routeMethods(relativeSourcePath, bytes.toString('utf8'));
    const row: InventoryRow = {
      ...classification,
      id: `storefront:${relativeSourcePath}`,
      methods,
      routePattern: normalizeRoutePattern(relativeSourcePath),
      sourceKind: 'storefront_entrypoint',
      sourcePath,
    };
    if (
      relativeSourcePath.endsWith('route.ts') &&
      methods.length > 0 &&
      !methods.includes('OPTIONS')
    ) {
      return [
        row,
        {
          decision: 'edge_release',
          id: `${row.id}:options`,
          methods: ['OPTIONS'],
          reason: 'automatic_options_response',
          routePattern: row.routePattern,
          sourceKind: 'storefront_entrypoint',
          sourcePath,
        },
      ];
    }
    return [row];
  });
}
