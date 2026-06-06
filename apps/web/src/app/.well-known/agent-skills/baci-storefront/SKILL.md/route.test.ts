// @vitest-environment node

import { describe, expect, it } from 'vitest';

describe('GET /.well-known/agent-skills/baci-storefront/SKILL.md', () => {
  it('serves the Baci storefront agent skill as markdown', async () => {
    const { GET } = await import('./route');
    const response = GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=3600, s-maxage=3600'
    );
    expect(response.headers.get('x-robots-tag')).toBe('noarchive');
    expect(body).toContain('name: baci-storefront');
    expect(body).toContain('https://ogabassey.com/.well-known/ucp');
    expect(body).toContain('https://mcp.ogabassey.com/mcp');
  });
});
