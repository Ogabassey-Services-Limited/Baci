// @vitest-environment node

import { describe, expect, it } from 'vitest';

describe('GET /auth.md', () => {
  it('serves agent auth guidance without claiming OAuth support', async () => {
    const { GET } = await import('./route');
    const response = GET(new Request('https://ogabassey.com/auth.md'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=3600, s-maxage=3600'
    );
    expect(response.headers.get('x-robots-tag')).toBe('noarchive');
    expect(body).toContain('# Ogabassey Agent Authentication');
    expect(body).toContain('https://ogabassey.com/agent-commerce.json');
    expect(body).toContain('bearer_hmac');
    expect(body).toContain('OAuth registration is not currently published');
  });
});
