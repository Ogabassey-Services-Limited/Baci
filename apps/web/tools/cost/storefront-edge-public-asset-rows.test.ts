import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_PUBLIC_ASSET_ROWS } from './storefront-edge-public-asset-rows';

describe('STOREFRONT_EDGE_PUBLIC_ASSET_ROWS', () => {
  it('enumerates the public assets referenced by released storefront output', () => {
    // Arrange and act
    const byPattern = new Map(
      STOREFRONT_EDGE_PUBLIC_ASSET_ROWS.map((row) => [row.routePattern, row])
    );

    // Assert
    expect([...byPattern.keys()]).toEqual(
      expect.arrayContaining([
        '/african-santa-head.svg',
        '/apple-touch-icon.png',
        '/baci-verified-favicon.svg',
        '/badges/app-store-black.svg',
        '/badges/google-play.svg',
        '/favicon-16x16.png',
        '/favicon-32x32.png',
        '/manifest.json',
        '/placeholder.png',
        '/placeholder.svg',
      ])
    );
    expect(byPattern.size).toBe(10);
    expect(
      STOREFRONT_EDGE_PUBLIC_ASSET_ROWS.every(
        (row) =>
          row.decision === 'edge_release' &&
          row.methods.join(',') === 'GET,HEAD' &&
          row.sourceKind === 'public_asset' &&
          row.sourcePath?.startsWith('apps/web/public/')
      )
    ).toBe(true);
  });
});
