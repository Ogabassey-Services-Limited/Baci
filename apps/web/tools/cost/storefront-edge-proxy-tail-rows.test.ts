import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_PROXY_TAIL_ROWS } from './storefront-edge-proxy-tail-rows';

describe('STOREFRONT_EDGE_PROXY_TAIL_ROWS', () => {
  it('keeps the blog sitemap rewrite unconditional and gates MCP rewrites', () => {
    const byId = new Map(
      STOREFRONT_EDGE_PROXY_TAIL_ROWS.map((row) => [row.id, row])
    );

    expect(byId.get('proxy:platform-root-blog-sitemap')).toEqual(
      expect.objectContaining({
        routePattern: '/blog/sitemap.xml',
        sourcePath: 'apps/web/next.config.ts',
      })
    );

    if (process.env.MCP_SERVER_URL) {
      expect(byId.get('proxy:mcp-sse-rewrite')).toBeDefined();
      expect(byId.get('proxy:mcp-messages-rewrite')).toBeDefined();
    } else {
      expect(byId.has('proxy:mcp-sse-rewrite')).toBe(false);
      expect(byId.has('proxy:mcp-messages-rewrite')).toBe(false);
    }
  });
});
