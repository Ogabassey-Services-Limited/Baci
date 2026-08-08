import { describe, expect, it } from 'vitest';
import { STOREFRONT_AGENT_ROUTES } from '../../src/config/storefront-agent-routes';
import { STOREFRONT_FEED_ROUTES } from '../../src/config/storefront-feed-routes';
import { STOREFRONT_EDGE_INVENTORY_POLICY } from './storefront-edge-inventory-policy';

describe('STOREFRONT_EDGE_INVENTORY_POLICY', () => {
  it('keeps row IDs unique and dynamic method families explicit', () => {
    // Arrange
    const rows = STOREFRONT_EDGE_INVENTORY_POLICY.extraRows;

    // Act
    const rowIds = rows.map((row) => row.id);
    const dynamicRows = rows.filter((row) => row.decision === 'origin_dynamic');

    // Assert
    expect(new Set(rowIds).size).toBe(rowIds.length);
    expect(dynamicRows.every((row) => !row.methods.includes('ANY'))).toBe(true);
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
    expect(patterns.get('/.well-known/{*unlisted}')).toEqual(
      expect.objectContaining({ decision: 'edge_terminal', methods: ['ANY'] })
    );
    expect(patterns.has('/.well-known/{*path}')).toBe(false);
  });

  it('preserves IndexNow and draft-mode requests without opening unknown paths', () => {
    // Arrange
    const rows = STOREFRONT_EDGE_INVENTORY_POLICY.extraRows;

    // Act
    const indexNow = rows.find((row) => row.id === 'machine:indexnow-key');
    const draftRows = rows.filter((row) =>
      row.id.startsWith('request-override:draft-mode')
    );

    // Assert
    expect(indexNow).toEqual(
      expect.objectContaining({
        decision: 'edge_release',
        methods: ['GET', 'HEAD'],
        routePattern: '/0751d5c882ab3d7c013ecbfe9e624d71.txt',
      })
    );
    expect(draftRows).toHaveLength(2);
    expect(draftRows.every((row) => row.decision === 'origin_dynamic')).toBe(
      true
    );
    expect(
      draftRows.every(
        (row) =>
          row.requestCondition?.precedence === 'before_path_decision' &&
          row.requestCondition.anyCookiePresent.join(',') ===
            '__next_preview_data,__prerender_bypass'
      )
    ).toBe(true);
    expect(rows.find((row) => row.id === 'api:unlisted')).toEqual(
      expect.objectContaining({ decision: 'edge_terminal', methods: ['ANY'] })
    );
  });

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
