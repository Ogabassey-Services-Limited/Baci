import { describe, expect, it } from 'vitest';
import { createStorefrontEdgeEntrypointRows } from './create-storefront-edge-entrypoint-rows';
import { STOREFRONT_EDGE_ENTRYPOINT_CLASSIFICATIONS } from './storefront-edge-entrypoint-classifications';

const routeRoot = 'apps/web/src/app/(storefront)/[slug]';

function entrypointSource(relativeSourcePath: string) {
  return {
    bytes: Buffer.from(
      relativeSourcePath.endsWith('route.ts')
        ? 'export async function GET() {}'
        : 'export default function Page() {}'
    ),
    sourcePath: `${routeRoot}/${relativeSourcePath}`,
  };
}

describe('createStorefrontEdgeEntrypointRows', () => {
  it('maps page, handler, and metadata conventions to public route patterns', () => {
    // Arrange
    const routeSources = [
      ...STOREFRONT_EDGE_ENTRYPOINT_CLASSIFICATIONS.keys().map(
        entrypointSource
      ),
      {
        bytes: Buffer.from('export default function Layout() {}'),
        sourcePath: `${routeRoot}/layout.tsx`,
      },
    ];

    // Act
    const rows = createStorefrontEdgeEntrypointRows(routeRoot, routeSources);

    // Assert
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          routePattern: '/',
          decision: 'edge_release',
        }),
        expect.objectContaining({
          routePattern: '/blog/{*catchAll}',
          decision: 'origin_dynamic',
          methods: ['GET', 'HEAD', 'OPTIONS'],
        }),
        expect.objectContaining({ routePattern: '/blog/sitemap.xml' }),
        expect.objectContaining({ routePattern: '/opengraph-image' }),
        expect.objectContaining({
          decision: 'origin_dynamic',
          routePattern: '/product/{productSlug}',
        }),
      ])
    );
    expect(rows).toHaveLength(76);
    expect(rows.every(({ methods }) => methods.includes('GET'))).toBe(true);
  });

  it('fails closed when a configured redirect entrypoint is missing', () => {
    // Arrange
    const routeSources = [...STOREFRONT_EDGE_ENTRYPOINT_CLASSIFICATIONS.keys()]
      .filter((path) => path !== 'news-sitemap.xml/route.ts')
      .map(entrypointSource);

    // Act and assert
    expect(() =>
      createStorefrontEdgeEntrypointRows(routeRoot, routeSources)
    ).toThrow(
      'redirect entrypoint no longer exists: news-sitemap.xml/route.ts'
    );
  });

  it('rejects a newly discovered entrypoint without an explicit classification', () => {
    // Arrange
    const routeSources = [
      ...STOREFRONT_EDGE_ENTRYPOINT_CLASSIFICATIONS.keys().map(
        entrypointSource
      ),
      entrypointSource('(subscriptions)/manage/page.tsx'),
    ];

    // Act and assert
    expect(() =>
      createStorefrontEdgeEntrypointRows(routeRoot, routeSources)
    ).toThrow(
      'storefront entrypoint has no reviewed classification: (subscriptions)/manage/page.tsx'
    );
  });
});
