import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('./storefront-edge-machine-source-paths');
  vi.resetModules();
});

describe('STOREFRONT_EDGE_MACHINE_ROWS', () => {
  it('models route-handler OPTIONS, metadata methods, and terminal ANY', async () => {
    // Arrange and act
    const { STOREFRONT_EDGE_MACHINE_ROWS } = await import(
      './storefront-edge-machine-rows'
    );
    const byId = new Map(
      STOREFRONT_EDGE_MACHINE_ROWS.map((row) => [row.id, row])
    );

    // Assert
    expect(byId.get('machine:feed-googleMerchantXml')?.methods).toEqual([
      'GET',
      'HEAD',
      'OPTIONS',
    ]);
    expect(byId.get('machine:robots')?.methods).toEqual(['GET', 'HEAD']);
    expect(byId.get('machine:robots-options')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['OPTIONS'],
        routePattern: '/robots.txt',
      })
    );
    expect(byId.get('machine:manifest')?.methods).toEqual(['GET', 'HEAD']);
    expect(byId.get('machine:manifest-options')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['OPTIONS'],
        routePattern: '/manifest.webmanifest',
      })
    );
    expect(byId.get('machine:indexnow-key-platform-subdomain')).toEqual(
      expect.objectContaining({
        hostCondition: {
          hostKind: 'platform_subdomain',
          precedence: 'before_path_decision',
        },
      })
    );
    expect(byId.get('machine:indexnow-key-platform-subdomain-options')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['OPTIONS'],
        routePattern: '/0751d5c882ab3d7c013ecbfe9e624d71.txt',
      })
    );
    expect(byId.get('machine:next-image')?.methods).toEqual(['ANY']);
    expect(byId.get('proxy:platform-subdomain-next-static')).toEqual(
      expect.objectContaining({
        decision: 'edge_redirect',
        hostCondition: {
          hostKind: 'platform_subdomain',
          precedence: 'before_path_decision',
        },
        routePattern: '/_next/static/{*asset}',
        sourcePath: 'apps/web/src/proxy.ts',
      })
    );
    expect(byId.get('machine:vercel-insights-view')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['POST'],
        routePattern: '/_vercel/insights/view',
      })
    );
    expect(byId.get('machine:vercel-speed-insights-vitals')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['POST'],
        routePattern: '/_vercel/speed-insights/vitals',
      })
    );
  });

  it('fails closed when a machine route has no declared source', async () => {
    // Arrange
    vi.doMock('./storefront-edge-machine-source-paths', () => ({
      STOREFRONT_EDGE_MACHINE_SOURCE_PATHS: {},
    }));

    // Act and assert
    await expect(import('./storefront-edge-machine-rows')).rejects.toThrow(
      'machine route source is not declared:'
    );
  });
});
