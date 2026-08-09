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
          methods: ['GET', 'HEAD', 'OPTIONS'],
          sourcePath: 'apps/web/src/app/sitemap.ts',
        })
      );
    }
  });
});
