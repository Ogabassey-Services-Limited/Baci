import { describe, expect, it } from 'vitest';
import task1aInventory from '../../../../docs/superpowers/evidence/storefront-edge/task-1a-inventory.json';
import { STOREFRONT_AGENT_ROUTES } from '../../src/config/storefront-agent-routes';
import { STOREFRONT_FEED_ROUTES } from '../../src/config/storefront-feed-routes';
import { STOREFRONT_EDGE_INVENTORY_POLICY } from './storefront-edge-inventory-policy';

function matchesRoutePattern(routePattern: string, pathname: string) {
  const patternSegments = routePattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);
  if (patternSegments.some((segment) => segment.startsWith('{*')))
    throw new Error(
      `catch-all route patterns are unsupported: ${routePattern}`
    );
  return (
    patternSegments.length === pathSegments.length &&
    patternSegments.every(
      (segment, index) =>
        (segment.startsWith('{') && segment.endsWith('}')) ||
        segment === pathSegments[index]
    )
  );
}

function resolveQueryDecision(pathname: string) {
  const baseRow = task1aInventory.rows.find(
    (row) => row.routePattern === pathname && !('requestCondition' in row)
  );
  if (!baseRow) throw new Error(`missing exact base row for ${pathname}`);
  const override = task1aInventory.rows.find((row) => {
    if (
      !('requestCondition' in row) ||
      row.requestCondition.anyQueryPresent !== true ||
      !matchesRoutePattern(row.routePattern, pathname)
    )
      return false;
    return (
      !('matchedStorefrontEntrypointId' in row.requestCondition) ||
      row.requestCondition.matchedStorefrontEntrypointId === baseRow.id
    );
  });
  return override?.decision ?? baseRow.decision;
}

describe('STOREFRONT_EDGE_INVENTORY_POLICY', () => {
  it('rejects catch-all patterns in the query-decision test matcher', () => {
    // Arrange, act, and assert
    expect(() => matchesRoutePattern('/blog/{*path}', '/blog/example')).toThrow(
      'catch-all route patterns are unsupported: /blog/{*path}'
    );
  });

  it('keeps row IDs unique and dynamic method families explicit', () => {
    // Arrange
    const rows = STOREFRONT_EDGE_INVENTORY_POLICY.extraRows;

    // Act
    const rowIds = rows.map((row) => row.id);
    const dynamicRows = rows.filter((row) => row.decision === 'origin_dynamic');

    // Assert
    expect(new Set(rowIds).size).toBe(rowIds.length);
    expect(
      dynamicRows
        .filter((row) => row.methods.includes('ANY'))
        .map(({ id }) => id)
    ).toEqual([
      'proxy:platform-admin',
      'proxy:custom-domain-platform-route',
      'proxy:api-prefix-passthrough',
    ]);
    expect(rows.find((row) => row.id === 'api:unlisted')).toEqual(
      expect.objectContaining({ decision: 'edge_terminal', methods: ['ANY'] })
    );
  });

  it('enumerates storefront agent, feed, and well-known routes before terminal defaults', () => {
    // Arrange
    const rows = STOREFRONT_EDGE_INVENTORY_POLICY.extraRows;
    const patterns = new Map(rows.map((row) => [row.routePattern, row]));

    // Act
    const configuredRoutes = [
      ...Object.values(STOREFRONT_AGENT_ROUTES),
      ...Object.values(STOREFRONT_FEED_ROUTES),
    ];

    // Assert
    for (const routePattern of configuredRoutes) {
      if (routePattern === STOREFRONT_AGENT_ROUTES.agenticApiBase) continue;
      expect(patterns.has(routePattern), `missing ${routePattern}`).toBe(true);
    }
    expect(patterns.get('/.well-known/{*unlisted?}')).toEqual(
      expect.objectContaining({ decision: 'edge_terminal', methods: ['ANY'] })
    );
    expect(patterns.has('/.well-known/{*path}')).toBe(false);
  });

  it('preserves IndexNow and draft-mode requests without opening unknown paths', () => {
    // Arrange
    const rows = STOREFRONT_EDGE_INVENTORY_POLICY.extraRows;

    // Act
    const indexNow = rows.filter((row) =>
      row.id.startsWith('machine:indexnow-key-')
    );
    const draftRows = rows.filter((row) =>
      row.id.startsWith('request-override:draft-mode')
    );

    // Assert
    expect(indexNow).toHaveLength(2);
    expect(indexNow).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'machine:indexnow-key-root',
          decision: 'edge_release',
          methods: ['GET', 'HEAD', 'OPTIONS'],
          routePattern: '/0751d5c882ab3d7c013ecbfe9e624d71.txt',
          hostCondition: expect.objectContaining({
            hostKind: 'platform_root_domain',
          }),
        }),
        expect.objectContaining({
          id: 'machine:indexnow-key-custom-domain',
          decision: 'edge_release',
          methods: ['GET', 'HEAD', 'OPTIONS'],
          routePattern: '/0751d5c882ab3d7c013ecbfe9e624d71.txt',
          hostCondition: expect.objectContaining({
            hostKind: 'custom_domain',
          }),
        }),
      ])
    );
    expect(draftRows).toHaveLength(2);
    expect(draftRows.every((row) => row.decision === 'origin_dynamic')).toBe(
      true
    );
    expect(
      draftRows.every(
        (row) =>
          row.requestCondition?.precedence === 'before_path_decision' &&
          row.requestCondition.anyCookiePresent?.join(',') ===
            '__next_preview_data,__prerender_bypass'
      )
    ).toBe(true);
    expect(rows.find((row) => row.id === 'api:unlisted')).toEqual(
      expect.objectContaining({ decision: 'edge_terminal', methods: ['ANY'] })
    );
  });

  it('keeps storefront actions, query variants, ads, and auth on the origin', () => {
    // Arrange
    const rows = STOREFRONT_EDGE_INVENTORY_POLICY.extraRows;
    const byId = new Map(rows.map((row) => [row.id, row]));
    const queryRows = rows.filter((row) =>
      row.id.startsWith('request-override:query-dependent')
    );

    // Act and assert
    expect(byId.get('server-action:repair-booking')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['POST'],
        routePattern: '/repair',
        sourcePath: 'apps/web/src/app/actions/repair.ts',
      })
    );
    expect(queryRows.map((row) => row.routePattern)).toEqual(
      expect.arrayContaining([
        '/blog',
        '/blog/author/{authorSlug}',
        '/blog/category/{categorySlug}',
        '/compare',
        '/{category}',
        '/{category}/compare',
        '/products',
        '/products/{productSlug}',
        '/{category}/{productSlug}',
      ])
    );
    expect(queryRows).toHaveLength(9);
    expect(
      queryRows.every(
        (row) =>
          row.decision === 'origin_dynamic' &&
          row.requestCondition?.anyQueryKeyPresent?.includes('page') &&
          row.requestCondition.matchedStorefrontEntrypointId ===
            `storefront:${row.sourcePath?.replace(
              'apps/web/src/app/(storefront)/[slug]/',
              ''
            )}` &&
          row.requestCondition.precedence ===
            'after_entrypoint_resolution_before_decision'
      )
    ).toBe(true);
    expect(byId.get('machine:ads')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['GET', 'HEAD', 'OPTIONS'],
        routePattern: '/ads.txt',
        sourcePath: 'apps/web/src/app/ads.txt/route.ts',
      })
    );
    expect(byId.get('proxy:auth-confirm')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['GET', 'HEAD', 'OPTIONS'],
        routePattern: '/auth/confirm',
        sourcePath: 'apps/web/src/app/auth/confirm/route.ts',
      })
    );
    expect(STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths).toEqual(
      expect.arrayContaining([
        'apps/web/src/app/actions/repair.ts',
        'apps/web/src/components/storefront/RepairBookingWizard.tsx',
        'apps/web/src/app/ads.txt/route.ts',
        'apps/web/src/app/auth/confirm/route.ts',
      ])
    );
  });

  it('bounds Next support routes and binds machine rows to reviewed sources', () => {
    // Arrange
    const machineRows = STOREFRONT_EDGE_INVENTORY_POLICY.extraRows.filter(
      (row) => row.sourceKind === 'machine_family'
    );
    const byId = new Map(machineRows.map((row) => [row.id, row]));

    // Act and assert
    expect(byId.get('machine:next-image')).toEqual(
      expect.objectContaining({ decision: 'edge_terminal', methods: ['ANY'] })
    );
    expect(byId.get('machine:next-static')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        requestCondition: {
          pathMembership: 'current_origin_next_build_manifest',
          precedence: 'before_path_decision',
        },
      })
    );
    expect(byId.get('machine:feed-googleMerchantXml')?.methods).toContain(
      'OPTIONS'
    );
    expect(machineRows.every((row) => row.sourcePath)).toBe(true);
  });

  it('keeps App Router data requests for released entrypoints on the origin', () => {
    // Arrange
    const row = STOREFRONT_EDGE_INVENTORY_POLICY.extraRows.find(
      ({ id }) => id === 'request-override:router-data'
    );

    // Act and assert
    expect(row).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['GET', 'HEAD'],
        requestCondition: {
          anyHeaderMatch: [
            { name: 'rsc', value: '1' },
            { name: 'next-router-prefetch' },
            { name: 'next-router-state-tree' },
          ],
          matchedStorefrontEntrypointDecision: 'edge_release',
          precedence: 'after_entrypoint_resolution_before_decision',
        },
      })
    );
  });

  it.each([
    ['/sitemap.xml', 'edge_release'],
    ['/blog/sitemap.xml', 'edge_release'],
    ['/terms', 'edge_release'],
  ] as const)(
    'keeps the special route %s on its base decision when a query is present',
    (pathname, expectedDecision) => {
      // Arrange: the query is represented by selecting query-conditioned rows.

      // Act
      const decision = resolveQueryDecision(pathname);

      // Assert
      expect(decision).toBe(expectedDecision);
    }
  );

  it('defines a closed nonzero eligible denominator', () => {
    // Arrange and act
    const { eligibleDenominatorPolicy } = STOREFRONT_EDGE_INVENTORY_POLICY;

    // Assert
    expect(eligibleDenominatorPolicy).toEqual({
      decisions: ['edge_redirect', 'edge_release'],
      methods: ['GET', 'HEAD'],
      scope: 'approved_pilot_hosts_and_complete_browser_automatic_traffic',
      zeroDenominatorVerdict: 'NOT_PROVEN',
    });
  });
});
