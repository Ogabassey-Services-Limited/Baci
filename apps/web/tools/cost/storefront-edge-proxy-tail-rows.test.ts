import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_PROXY_TAIL_ROWS } from './storefront-edge-proxy-tail-rows';

describe('STOREFRONT_EDGE_PROXY_TAIL_ROWS', () => {
  it('keeps closed terminal defaults after host-conditioned rows', () => {
    const ids = STOREFRONT_EDGE_PROXY_TAIL_ROWS.map(({ id }) => id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'proxy:unknown-document',
        'proxy:unsafe-document',
        'proxy:unsupported-method',
      ])
    );
    expect(ids.indexOf('proxy:unknown-document')).toBeGreaterThan(
      ids.indexOf('proxy:root-sitemap')
    );
    expect(ids).toContain('proxy:platform-root-slug-sitemap');
  });

  it('keeps request-aware root sitemaps on the origin', () => {
    // Arrange
    const byId = new Map(
      STOREFRONT_EDGE_PROXY_TAIL_ROWS.map((row) => [row.id, row])
    );

    // Act and assert
    for (const id of ['proxy:root-sitemap', 'proxy:subdomain-sitemap']) {
      expect(byId.get(id)).toEqual(
        expect.objectContaining({
          decision: 'origin_dynamic',
          methods: ['GET', 'HEAD'],
          sourcePath: 'apps/web/src/app/sitemap.ts',
        })
      );
    }
  });

  it('keeps metadata OPTIONS and MCP rewrites on the origin', () => {
    const byId = new Map(
      STOREFRONT_EDGE_PROXY_TAIL_ROWS.map((row) => [row.id, row])
    );

    for (const id of [
      'proxy:platform-root-blog-sitemap-options',
      'proxy:platform-root-slug-sitemap-options',
      'proxy:root-sitemap-options',
      'proxy:subdomain-sitemap-options',
      'proxy:platform-root-sitemap-options',
    ]) {
      expect(byId.get(id)).toEqual(
        expect.objectContaining({
          decision: 'origin_dynamic',
          methods: ['OPTIONS'],
          reason: 'automatic_options_response',
        })
      );
    }

    expect(byId.get('proxy:mcp-sse-rewrite')).toEqual(
      expect.objectContaining({
        decision: 'origin_dynamic',
        methods: ['ANY'],
        routePattern: '/mcp/sse',
        sourcePath: 'apps/web/next.config.ts',
      })
    );
    expect(byId.get('proxy:mcp-messages-rewrite')).toEqual(
      expect.objectContaining({ routePattern: '/mcp/messages' })
    );
  });
});
