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

  it('preserves Markdown mirrors and custom-domain auth confirmation', () => {
    // Arrange
    const byId = new Map(
      STOREFRONT_EDGE_PROXY_ROWS.map((row) => [row.id, row])
    );

    // Act and assert
    expect(byId.get('proxy:markdown-mirror')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['GET', 'HEAD'],
        routePattern: '/{*storefrontMarkdownPath}.md',
      })
    );
    expect(byId.get('proxy:auth-confirm')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['GET', 'HEAD'],
        routePattern: '/auth/confirm',
      })
    );
  });

  it('applies the canonical-domain redirect only to eligible platform subdomains', () => {
    // Arrange
    const row = STOREFRONT_EDGE_PROXY_ROWS.find(
      ({ id }) => id === 'proxy:subdomain-custom-domain'
    );

    // Act and assert
    expect(row).toEqual(
      expect.objectContaining({
        hostCondition: {
          hostKind: 'platform_subdomain',
          requiresActiveCanonicalCustomDomain: true,
          precedence: 'before_path_decision',
        },
      })
    );
  });
});
