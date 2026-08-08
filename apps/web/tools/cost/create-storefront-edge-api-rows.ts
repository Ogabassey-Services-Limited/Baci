import { extractStorefrontRouteMethods } from './extract-storefront-route-methods';
import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

type InventoryRow = StorefrontEdgeInventory['rows'][number];
type SourceFile = Readonly<{ bytes: Buffer; sourcePath: string }>;

function normalizeSegment(segment: string) {
  const catchAll = segment.match(/^\[\.\.\.([^\]]+)]$/);
  if (catchAll) return `{*${catchAll[1]}}`;
  const optionalCatchAll = segment.match(/^\[\[\.\.\.([^\]]+)]]$/);
  if (optionalCatchAll) return `{*${optionalCatchAll[1]}?}`;
  const parameter = segment.match(/^\[([^\]]+)]$/);
  return parameter ? `{${parameter[1]}}` : segment;
}

/** Creates an exact dynamic-origin row for every real Next API route handler. */
export function createStorefrontEdgeApiRows(
  apiRoot: string,
  apiSources: readonly SourceFile[]
): InventoryRow[] {
  const prefix = `${apiRoot.replace(/\/$/, '')}/`;
  return apiSources.map(({ bytes, sourcePath }) => {
    if (!sourcePath.startsWith(prefix) || !sourcePath.endsWith('/route.ts'))
      throw new Error('storefront API source is outside the API route root');
    const relativeSourcePath = sourcePath.slice(prefix.length);
    const methods = extractStorefrontRouteMethods(bytes.toString('utf8'), {
      includeAutomaticOptions: true,
    });
    if (methods.length === 0)
      throw new Error(
        `storefront API route exports no HTTP method: ${sourcePath}`
      );
    const routeSegments = relativeSourcePath
      .split('/')
      .slice(0, -1)
      .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
      .map(normalizeSegment);
    return {
      decision: 'origin_dynamic',
      id: `api-route:${relativeSourcePath}`,
      methods,
      reason: 'exact_storefront_api_route',
      routePattern: `/api/${routeSegments.join('/')}`,
      sourceKind: 'api_route',
      sourcePath,
    };
  });
}
