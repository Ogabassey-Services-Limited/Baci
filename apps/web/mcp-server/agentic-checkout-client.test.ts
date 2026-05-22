import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  AGENTIC_CHECKOUT_API_VERSION,
  AGENTIC_CHECKOUT_USER_AGENT,
  createAgenticCheckoutSession,
  signAgenticRequest,
} from './agentic-checkout-client';

describe('createAgenticCheckoutSession', () => {
  it('uses an OpenAI-identifying default user agent for checkout requests', () => {
    expect(AGENTIC_CHECKOUT_USER_AGENT.toLowerCase()).toContain('openai');
  });

  it('posts a signed request to the Baci agentic checkout session endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'agentic_session_1',
          status: 'not_ready_for_payment',
        }),
        { status: 201 }
      )
    );

    const result = await createAgenticCheckoutSession(
      {
        idempotency_key: 'idem-checkout-1',
        items: [{ id: 'product-1', quantity: 2 }],
      },
      {
        apiBaseUrl: 'https://ogabassey.com',
        apiKey: 'agentic-api-key',
        fetchImpl,
        now: () => new Date('2026-05-21T12:00:00.000Z'),
        requestIdFactory: () => 'request-1',
        signingKey: 'signing-secret',
      }
    );

    expect(result).toMatchObject({
      endpoint: 'https://ogabassey.com/api/agentic/checkout_sessions',
      idempotencyKey: 'idem-checkout-1',
      ok: true,
      requestId: 'request-1',
      status: 201,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ogabassey.com/api/agentic/checkout_sessions');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({
        currency: 'NGN',
        items: [{ id: 'product-1', quantity: 2 }],
      })
    );
    expect(init.headers).toMatchObject({
      'api-version': AGENTIC_CHECKOUT_API_VERSION,
      authorization: 'Bearer agentic-api-key',
      'content-type': 'application/json',
      'idempotency-key': 'idem-checkout-1',
      'request-id': 'request-1',
      timestamp: '2026-05-21T12:00:00.000Z',
      'user-agent': AGENTIC_CHECKOUT_USER_AGENT,
    });
    const headers = init.headers as Record<string, string>;
    const expectedSignature = createHmac('sha256', 'signing-secret')
      .update(
        JSON.stringify({
          api_version: AGENTIC_CHECKOUT_API_VERSION,
          body: init.body,
          idempotency_key: 'idem-checkout-1',
          method: 'POST',
          pathname: '/api/agentic/checkout_sessions',
          request_id: 'request-1',
          timestamp: '2026-05-21T12:00:00.000Z',
        })
      )
      .digest('hex');
    expect(headers.signature).toBe(expectedSignature);
  });

  it('fails closed when agentic checkout credentials are not configured', async () => {
    const fetchImpl = vi.fn();

    const result = await createAgenticCheckoutSession(
      { items: [{ id: 'product-1', quantity: 1 }] },
      {
        apiBaseUrl: 'https://ogabassey.com',
        fetchImpl,
      }
    );

    expect(result).toEqual({
      error: 'Agentic checkout credentials are not configured',
      ok: false,
      status: 503,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns route errors without exposing signing material', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );

    const result = await createAgenticCheckoutSession(
      { items: [{ id: 'product-1', quantity: 1 }] },
      {
        apiBaseUrl: 'https://ogabassey.com',
        apiKey: 'agentic-api-key',
        fetchImpl,
        requestIdFactory: () => 'request-1',
        signingKey: 'signing-secret',
      }
    );

    expect(result).toMatchObject({
      error: 'Unauthorized',
      ok: false,
      status: 401,
    });
    expect(JSON.stringify(result)).not.toContain('signing-secret');
  });
});

describe('signAgenticRequest', () => {
  it('matches the canonical request signature payload used by the agentic API', () => {
    expect(
      signAgenticRequest({
        apiVersion: AGENTIC_CHECKOUT_API_VERSION,
        body: '{"items":[]}',
        idempotencyKey: 'idem-1',
        method: 'post',
        pathname: '/api/agentic/checkout_sessions',
        requestId: 'request-1',
        signingKey: 'secret',
        timestamp: '2026-05-21T12:00:00.000Z',
      })
    ).toBe(
      createHmac('sha256', 'secret')
        .update(
          JSON.stringify({
            api_version: AGENTIC_CHECKOUT_API_VERSION,
            body: '{"items":[]}',
            idempotency_key: 'idem-1',
            method: 'POST',
            pathname: '/api/agentic/checkout_sessions',
            request_id: 'request-1',
            timestamp: '2026-05-21T12:00:00.000Z',
          })
        )
        .digest('hex')
    );
  });
});
