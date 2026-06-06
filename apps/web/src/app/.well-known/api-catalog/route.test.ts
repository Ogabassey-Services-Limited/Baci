// @vitest-environment node

import { describe, expect, it } from 'vitest';

describe('GET /.well-known/api-catalog', () => {
  it('publishes a Linkset API catalog for the current storefront origin', async () => {
    const { GET } = await import('./route');
    const response = GET(
      new Request('https://ogabassey.com/.well-known/api-catalog', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      'application/linkset+json'
    );
    expect(body.linkset).toEqual([
      expect.objectContaining({
        anchor: 'https://ogabassey.com/api/agentic',
        'service-desc': [
          {
            href: 'https://ogabassey.com/openapi.json',
            type: 'application/vnd.oai.openapi+json',
          },
        ],
        'service-doc': [
          {
            href: 'https://ogabassey.com/auth.md',
            type: 'text/markdown',
          },
        ],
        status: [
          {
            href: 'https://mcp.ogabassey.com/health',
            type: 'application/json',
          },
        ],
      }),
    ]);
    expect(response.headers.get('cache-control')).toContain('max-age=3600');
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
  });
});
