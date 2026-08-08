import { describe, expect, it } from 'vitest';
import { createStorefrontEdgePosthogRelayRows } from './storefront-edge-posthog-relay-rows';

describe('createStorefrontEdgePosthogRelayRows', () => {
  it('includes the normalized configured relay root and descendants', () => {
    // Arrange and act
    const rows = createStorefrontEdgePosthogRelayRows(' baci-observe/ ');

    // Assert
    expect(rows.map(({ routePattern }) => routePattern)).toEqual([
      '/baci-observe',
      '/baci-observe/{*path}',
    ]);
    expect(rows.every(({ methods }) => methods.includes('POST'))).toBe(true);
  });

  it('falls back from a reserved relay path to the reviewed default', () => {
    // Arrange and act
    const rows = createStorefrontEdgePosthogRelayRows('/api');

    // Assert
    expect(rows[0]?.routePattern).toBe('/baci-relay');
  });
});
