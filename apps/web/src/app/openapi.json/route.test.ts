// @vitest-environment node

import { describe, expect, it } from 'vitest';

describe('GET /openapi.json', () => {
  it('publishes an OpenAPI description for public agentic commerce routes', async () => {
    const { GET } = await import('./route');
    const response = GET(
      new Request('https://ogabassey.com/openapi.json', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBe('Ogabassey Agentic Commerce API');
    expect(body.servers).toEqual([{ url: 'https://ogabassey.com' }]);
    expect(body.paths).toMatchObject({
      '/api/agentic/catalog/search': expect.any(Object),
      '/api/agentic/catalog/product': expect.any(Object),
      '/api/agentic/checkout-sessions': expect.any(Object),
      '/api/agentic/checkout-sessions/{id}': expect.any(Object),
      '/api/agentic/orders/{id}': expect.any(Object),
    });
    expect(body.components.securitySchemes.agenticBearerHmac).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });
});
