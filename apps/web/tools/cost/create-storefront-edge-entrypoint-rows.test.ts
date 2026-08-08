import { describe, expect, it } from 'vitest';
import { createStorefrontEdgeEntrypointRows } from './create-storefront-edge-entrypoint-rows';

const routeRoot = 'apps/web/src/app/(storefront)/[slug]';

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
          decision: 'edge_redirect',
        }),
        expect.objectContaining({ routePattern: '/blog/sitemap.xml' }),
        expect.objectContaining({ routePattern: '/opengraph-image' }),
      ])
    );
    expect(rows).toHaveLength(4);
    expect(rows.every(({ methods }) => methods.includes('GET'))).toBe(true);
  });
});
