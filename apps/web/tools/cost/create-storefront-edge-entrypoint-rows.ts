import { extractStorefrontRouteMethods } from './extract-storefront-route-methods';
import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

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
const REDIRECT_ENTRYPOINTS = new Set([
  '(blog)/blog/[...catchAll]/route.ts',
  '(catalog)/(pdp)/product/[productSlug]/page.tsx',
  '(content)/pages/about/page.tsx',
  '(content)/pages/blog/page.tsx',
  '(content)/pages/contact/page.tsx',
  '(content)/pages/faq/page.tsx',
  '(content)/pages/privacy/page.tsx',
  '(content)/pages/terms/page.tsx',
  '(content)/privacy-policy/page.tsx',
  '(content)/terms-and-conditions/page.tsx',
  '(content)/terms-of-service/page.tsx',
  'favicon.ico/route.ts',
  'news-sitemap.xml/route.ts',
  'storefront/[legacySlug]/swap/route.ts',
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

function normalizeSegment(segment: string) {
  const catchAll = segment.match(/^\[\.\.\.([^\]]+)]$/);
  if (catchAll) return `{*${catchAll[1]}}`;
  const parameter = segment.match(/^\[([^\]]+)]$/);
  return parameter ? `{${parameter[1]}}` : segment;
}

function normalizeRoutePattern(relativeSourcePath: string) {
  const fileName = entrypointFileName(relativeSourcePath);
  const metadataSuffix = METADATA_ROUTE_SUFFIXES.get(fileName);
  const segments = relativeSourcePath
    .split('/')
    .slice(0, -1)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
    .map(normalizeSegment);
  if (metadataSuffix) segments.push(metadataSuffix);
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

function routeMethods(relativeSourcePath: string, source: string) {
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

function classifyEntrypoint(
  relativeSourcePath: string
): Pick<InventoryRow, 'decision' | 'reason'> {
  if (REDIRECT_ENTRYPOINTS.has(relativeSourcePath))
    return {
      decision: 'edge_redirect',
      reason: 'redirect_only_storefront_entrypoint',
    };
  if (
    relativeSourcePath.startsWith('(commerce)/') ||
    relativeSourcePath.startsWith('(customer)/') ||
    relativeSourcePath.startsWith('(utility)/') ||
    relativeSourcePath === '(catalog)/(listing)/search/page.tsx' ||
    relativeSourcePath === '(content)/pages/rewards/page.tsx'
  )
    return {
      decision: 'origin_dynamic',
      reason: 'request_state_or_origin_action_required',
    };
  return { decision: 'edge_release', reason: 'public_release_surface' };
}

/** Builds closed route rows from source bytes already bound to origin/main. */
export function createStorefrontEdgeEntrypointRows(
  routeRoot: string,
  routeSources: readonly SourceFile[]
): InventoryRow[] {
  const prefix = `${routeRoot.replace(/\/$/, '')}/`;
  return routeSources
    .filter(({ sourcePath }) =>
      isEntrypoint(
        sourcePath.startsWith(prefix) ? sourcePath.slice(prefix.length) : ''
      )
    )
    .map(({ bytes, sourcePath }) => {
      if (!sourcePath.startsWith(prefix))
        throw new Error('storefront route source is outside the route root');
      const relativeSourcePath = sourcePath.slice(prefix.length);
      return {
        ...classifyEntrypoint(relativeSourcePath),
        id: `storefront:${relativeSourcePath}`,
        methods: routeMethods(relativeSourcePath, bytes.toString('utf8')),
        routePattern: normalizeRoutePattern(relativeSourcePath),
        sourceKind: 'storefront_entrypoint',
        sourcePath,
      };
    });
}
