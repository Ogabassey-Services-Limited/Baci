import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_PROXY_ROWS } from './storefront-edge-proxy-rows';

describe('STOREFRONT_EDGE_PROXY_ROWS', () => {
  it('pins mutation rewrites and retired endpoints to their safe outcomes', () => {
    // Arrange
    const byId = new Map(
      STOREFRONT_EDGE_PROXY_ROWS.map((row) => [row.id, row])
    );

    // Act and assert
    expect(byId.get('proxy:legacy-analytics-conversion')).toEqual(
      expect.objectContaining({ decision: 'origin_dynamic', methods: ['POST'] })
    );
    expect(byId.get('proxy:legacy-klump-webhook')).toEqual(
      expect.objectContaining({ decision: 'edge_terminal', methods: ['ANY'] })
    );
    expect(byId.get('proxy:legacy-terms-alias')?.decision).toBe(
      'edge_redirect'
    );
    expect(byId.get('proxy:root-sitemap')?.decision).toBe('edge_release');
  });

  it('contains explicit unknown-path and unsupported-method terminal classes', () => {
    // Arrange and act
    const terminals = STOREFRONT_EDGE_PROXY_ROWS.filter(
      (row) => row.decision === 'edge_terminal'
    ).map((row) => row.id);

    // Assert
    expect(terminals).toEqual(
      expect.arrayContaining([
        'proxy:unknown-document',
        'proxy:unsafe-document',
        'proxy:unsupported-method',
      ])
    );
  });
});
