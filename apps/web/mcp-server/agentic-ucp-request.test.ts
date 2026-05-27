import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  AGENTIC_CHECKOUT_AGENT_ID,
  AGENTIC_CHECKOUT_API_VERSION,
  AGENTIC_CHECKOUT_USER_AGENT,
} from './agentic-checkout-client';
import { sendAgenticUcpRequest } from './agentic-ucp-request';

describe('sendAgenticUcpRequest', () => {
  it('fails closed when signed UCP credentials are missing', async () => {
    const fetchImpl = vi.fn();

    const result = await sendAgenticUcpRequest({
      config: { apiBaseUrl: 'https://ogabassey.com', fetchImpl },
      method: 'GET',
      pathname: '/api/agentic/carts/cart_1',
    });

    expect(result).toEqual({
      error: 'Agentic UCP credentials are not configured',
      ok: false,
      status: 503,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends a signed UCP request without an idempotency header for reads', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'cart_1', status: 'active' }), {
        status: 200,
      })
    );

    const result = await sendAgenticUcpRequest({
      config: {
        apiBaseUrl: 'https://ogabassey.com',
        apiKey: 'agentic-api-key',
        fetchImpl,
        now: () => new Date('2026-05-26T12:00:00.000Z'),
        requestIdFactory: () => 'request-1',
        signingKey: 'signing-secret',
      },
      method: 'GET',
      pathname: '/api/agentic/carts/cart_1',
    });

    expect(result).toMatchObject({
      endpoint: 'https://ogabassey.com/api/agentic/carts/cart_1',
      ok: true,
      requestId: 'request-1',
      status: 200,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ogabassey.com/api/agentic/carts/cart_1');
    expect(init.body).toBeUndefined();
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({
      'agent-id': AGENTIC_CHECKOUT_AGENT_ID,
      'api-version': AGENTIC_CHECKOUT_API_VERSION,
      authorization: 'Bearer agentic-api-key',
      'request-id': 'request-1',
      timestamp: '2026-05-26T12:00:00.000Z',
      'user-agent': AGENTIC_CHECKOUT_USER_AGENT,
    });
    const headers = init.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBeUndefined();
    expect(headers.signature).toBe(
      createHmac('sha256', 'signing-secret')
        .update(
          JSON.stringify({
            api_version: AGENTIC_CHECKOUT_API_VERSION,
            body: '',
            idempotency_key: '',
            method: 'GET',
            pathname: '/api/agentic/carts/cart_1',
            request_id: 'request-1',
            timestamp: '2026-05-26T12:00:00.000Z',
            agent_id: AGENTIC_CHECKOUT_AGENT_ID,
          })
        )
        .digest('hex')
    );
  });

  it('sends POST bodies with content type and idempotency headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const body = { line_items: [{ item: { id: 'product-1' }, quantity: 1 }] };

    await sendAgenticUcpRequest({
      body,
      config: {
        apiBaseUrl: 'https://ogabassey.com',
        apiKey: 'agentic-api-key',
        fetchImpl,
        requestIdFactory: () => 'request-1',
        signingKey: 'signing-secret',
      },
      idempotencyKey: 'idem-cart-1',
      method: 'POST',
      pathname: '/api/agentic/carts',
    });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify(body));
    expect(init.headers).toMatchObject({
      'content-type': 'application/json',
      'idempotency-key': 'idem-cart-1',
    });
  });

  it('returns parsed route errors without throwing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'missing', error: 'Cart not found' }), {
        status: 404,
      })
    );

    const result = await sendAgenticUcpRequest({
      config: {
        apiBaseUrl: 'https://ogabassey.com',
        apiKey: 'agentic-api-key',
        fetchImpl,
        requestIdFactory: () => 'request-1',
        signingKey: 'signing-secret',
      },
      method: 'GET',
      pathname: '/api/agentic/carts/cart_404',
    });

    expect(result).toMatchObject({
      details: { code: 'missing', error: 'Cart not found' },
      error: 'Cart not found',
      ok: false,
      status: 404,
    });
  });

  it('returns raw text success responses and structured fetch failures', async () => {
    const textFetch = vi
      .fn()
      .mockResolvedValue(new Response('accepted', { status: 202 }));

    const textResult = await sendAgenticUcpRequest({
      config: {
        apiBaseUrl: 'https://ogabassey.com',
        apiKey: 'agentic-api-key',
        fetchImpl: textFetch,
        requestIdFactory: () => 'request-1',
        signingKey: 'signing-secret',
      },
      method: 'GET',
      pathname: '/api/agentic/carts/cart_1',
    });

    expect(textResult).toMatchObject({
      ok: true,
      response: { raw: 'accepted' },
      status: 202,
    });

    const failingFetch = vi.fn().mockRejectedValue(new Error('network down'));
    const failure = await sendAgenticUcpRequest({
      config: {
        apiBaseUrl: 'https://ogabassey.com',
        apiKey: 'agentic-api-key',
        fetchImpl: failingFetch,
        requestIdFactory: () => 'request-1',
        signingKey: 'signing-secret',
      },
      method: 'GET',
      pathname: '/api/agentic/carts/cart_1',
    });

    expect(failure).toMatchObject({
      error: 'network down',
      ok: false,
      status: 502,
    });
  });
});
