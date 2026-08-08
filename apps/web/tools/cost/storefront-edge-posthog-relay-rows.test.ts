import { describe, expect, it } from 'vitest';
import { createStorefrontEdgePosthogRelayRows } from './storefront-edge-posthog-relay-rows';

describe('createStorefrontEdgePosthogRelayRows', () => {
  it('includes the normalized configured relay root and descendants', () => {
    // Arrange and act
    const rows = createStorefrontEdgePosthogRelayRows(' baci-observe/ ');

    // Assert
    const originRows = rows.filter(
      ({ decision }) => decision === 'origin_dynamic'
    );
    expect(originRows.map(({ routePattern }) => routePattern)).toEqual([
      '/baci-observe',
      '/baci-observe/{*path}',
    ]);
    expect(originRows.every(({ methods }) => methods.includes('POST'))).toBe(
      true
    );
    expect(rows.filter(({ decision }) => decision === 'edge_redirect')).toEqual(
      [
        expect.objectContaining({
          hostCondition: expect.objectContaining({
            hostKind: 'platform_subdomain',
          }),
          routePattern: '/baci-observe',
        }),
        expect.objectContaining({
          hostCondition: expect.objectContaining({
            hostKind: 'platform_subdomain',
          }),
          routePattern: '/baci-observe/{*path}',
        }),
      ]
    );
  });

  it('uses the reviewed default when the relay path is empty', () => {
    // Arrange and act
    const rows = createStorefrontEdgePosthogRelayRows('  ');

    // Assert
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision: 'origin_dynamic',
          routePattern: '/baci-relay',
        }),
      ])
    );
  });

  it.each([
    '/api',
    '/api/relay',
    '/Baci-Relay',
    '/relay?x=1',
  ])('rejects the noncanonical relay path %s', (configuredPath) => {
    // Arrange, act, and assert
    expect(() => createStorefrontEdgePosthogRelayRows(configuredPath)).toThrow(
      'posthog relay path'
    );
  });
});
