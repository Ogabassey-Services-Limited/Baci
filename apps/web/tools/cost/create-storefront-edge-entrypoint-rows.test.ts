import { describe, expect, it } from 'vitest';
import { createStorefrontEdgeEntrypointRows } from './create-storefront-edge-entrypoint-rows';
import { STOREFRONT_EDGE_REDIRECT_ENTRYPOINTS } from './storefront-edge-redirect-entrypoints';

const routeRoot = 'apps/web/src/app/(storefront)/[slug]';

function redirectSource(relativeSourcePath: string) {
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
      {
        bytes: Buffer.from('export default function Page() {}'),
        sourcePath: `${routeRoot}/(home)/page.tsx`,
      },
      {
        bytes: Buffer.from('export async function GET() {}'),
        sourcePath: `${routeRoot}/(blog)/blog/[...catchAll]/route.ts`,
      },
      {
        bytes: Buffer.from('export default async function sitemap() {}'),
        sourcePath: `${routeRoot}/(blog)/blog/sitemap.ts`,
      },
      {
        bytes: Buffer.from('export default async function Image() {}'),
        sourcePath: `${routeRoot}/opengraph-image.tsx`,
      },
      {
        bytes: Buffer.from('export default function Page() {}'),
        sourcePath: `${routeRoot}/(content)/archive/[[...path]]/page.tsx`,
      },
      {
        bytes: Buffer.from('export default function Layout() {}'),
        sourcePath: `${routeRoot}/layout.tsx`,
      },
      ...STOREFRONT_EDGE_REDIRECT_ENTRYPOINTS.filter(
        (path) => path !== '(blog)/blog/[...catchAll]/route.ts'
      ).map(redirectSource),
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
          decision: 'edge_redirect',
        }),
        expect.objectContaining({ routePattern: '/blog/sitemap.xml' }),
        expect.objectContaining({ routePattern: '/opengraph-image' }),
        expect.objectContaining({ routePattern: '/archive/{*path?}' }),
      ])
    );
    expect(rows).toHaveLength(18);
    expect(rows.every(({ methods }) => methods.includes('GET'))).toBe(true);
  });

  it('fails closed when a configured redirect entrypoint is missing', () => {
    // Arrange
    const routeSources = STOREFRONT_EDGE_REDIRECT_ENTRYPOINTS.filter(
      (path) => path !== 'news-sitemap.xml/route.ts'
    ).map(redirectSource);

    // Act and assert
    expect(() =>
      createStorefrontEdgeEntrypointRows(routeRoot, routeSources)
    ).toThrow(
      'redirect entrypoint no longer exists: news-sitemap.xml/route.ts'
    );
  });
});
