import { describe, expect, it } from 'vitest';
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
