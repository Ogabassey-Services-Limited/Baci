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

  it('falls back from a reserved relay path to the reviewed default', () => {
    // Arrange and act
    const rows = createStorefrontEdgePosthogRelayRows('/api');

    // Assert
    expect(rows[0]?.routePattern).toBe('/baci-relay');
  });
});
