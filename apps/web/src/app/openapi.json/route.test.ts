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
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBe('Ogabassey Agentic Commerce API');
    expect(body.servers).toEqual([{ url: 'https://ogabassey.com' }]);
    expect(body.paths).toMatchObject({
      '/api/agentic/catalog/search': expect.any(Object),
      '/api/agentic/catalog/product': expect.any(Object),
      '/api/agentic/checkout-sessions': expect.any(Object),
      '/api/agentic/checkout-sessions/{id}': expect.any(Object),
      '/api/agentic/checkout-sessions/{id}/complete': expect.any(Object),
      '/api/agentic/orders/{id}': expect.any(Object),
    });
    expect(body.paths).not.toHaveProperty('/api/shipping/quote');
    expect(body.paths).not.toHaveProperty('/api/shipping/quotes');
    expect(
      body.paths['/api/agentic/checkout-sessions/{id}/complete'].post
    ).toMatchObject({
      operationId: 'completeCheckoutSession',
      'x-payment-info': {
        intent: 'charge',
        method: 'card',
        amount: null,
        currency: 'NGN',
      },
      responses: {
        '200': expect.any(Object),
        '402': { description: 'Payment Required' },
      },
    });
    expect(
      body.components.schemas.CheckoutCompleteRequest.properties.payment_data
        .properties.provider.enum
    ).toEqual(['paystack', 'paystack_bank_transfer']);
    expect(body.components.securitySchemes.agenticBearerHmac).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });
});
