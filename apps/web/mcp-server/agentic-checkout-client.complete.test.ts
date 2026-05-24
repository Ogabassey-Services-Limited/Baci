import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  AGENTIC_CHECKOUT_API_VERSION,
  AGENTIC_CHECKOUT_USER_AGENT,
  completeAgenticCheckoutSession,
} from './agentic-checkout-client';

describe('completeAgenticCheckoutSession', () => {
  it('posts a signed checkout completion request and normalizes the Paystack method alias', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'agentic_session_1',
          payment_state: 'payment_pending',
          status: 'ready_for_payment',
        }),
        { status: 200 }
      )
    );

    const result = await completeAgenticCheckoutSession(
      {
        buyer: {
          email: 'buyer@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          phone_number: '+2348012345678',
        },
        completion_authorization: {
          amount: 150000,
          confirmed_at: '2026-05-21T12:00:00.000Z',
          currency: 'ngn',
          session_id: 'agentic_session_1',
          signature: 'confirmation-signature-1234567890abcdef',
          type: 'human_confirmation',
        },
        idempotency_key: 'idem-complete-1',
        payment_data: {
          provider: 'paystack_bank_transfer',
          token: 'payment-token-1',
        },
        session_id: 'agentic_session_1',
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
      endpoint:
        'https://ogabassey.com/api/agentic/checkout_sessions/agentic_session_1/complete',
      idempotencyKey: 'idem-complete-1',
      ok: true,
      requestId: 'request-1',
      status: 200,
    });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+2348012345678',
      },
      completion_authorization: {
        amount: 150000,
        confirmed_at: '2026-05-21T12:00:00.000Z',
        currency: 'NGN',
        session_id: 'agentic_session_1',
        signature: 'confirmation-signature-1234567890abcdef',
        type: 'human_confirmation',
      },
      payment_data: {
        provider: 'paystack',
        token: 'payment-token-1',
      },
    });
    expect(init.headers).toMatchObject({
      'api-version': AGENTIC_CHECKOUT_API_VERSION,
      authorization: 'Bearer agentic-api-key',
      'content-type': 'application/json',
      'idempotency-key': 'idem-complete-1',
      'request-id': 'request-1',
      timestamp: '2026-05-21T12:00:00.000Z',
      'user-agent': AGENTIC_CHECKOUT_USER_AGENT,
    });
    const headers = init.headers as Record<string, string>;
    expect(headers.signature).toBe(
      createHmac('sha256', 'signing-secret')
        .update(
          JSON.stringify({
            api_version: AGENTIC_CHECKOUT_API_VERSION,
            body: init.body,
            idempotency_key: 'idem-complete-1',
            method: 'POST',
            pathname:
              '/api/agentic/checkout_sessions/agentic_session_1/complete',
            request_id: 'request-1',
            timestamp: '2026-05-21T12:00:00.000Z',
          })
        )
        .digest('hex')
    );
  });

  it('generates and sends an idempotency key when one is omitted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'agentic_session_1' }), {
        status: 200,
      })
    );

    const result = await completeAgenticCheckoutSession(
      {
        buyer: {
          email: 'buyer@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          phone_number: '+2348012345678',
        },
        payment_data: {
          provider: 'pay_on_delivery',
        },
        session_id: 'agentic_session_1',
      },
      {
        apiBaseUrl: 'https://ogabassey.com',
        apiKey: 'agentic-api-key',
        fetchImpl,
        requestIdFactory: () => 'request-1',
        signingKey: 'signing-secret',
      }
    );

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['idempotency-key']).toMatch(/^mcp_checkout_complete_/);
    expect(result).toMatchObject({
      idempotencyKey: headers['idempotency-key'],
      ok: true,
      requestId: 'request-1',
      status: 200,
    });
  });

  it('fails closed when checkout completion credentials are not configured', async () => {
    const fetchImpl = vi.fn();

    const result = await completeAgenticCheckoutSession(
      {
        buyer: {
          email: 'buyer@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          phone_number: '+2348012345678',
        },
        idempotency_key: 'idem-complete-1',
        payment_data: {
          provider: 'pay_on_delivery',
        },
        session_id: 'agentic_session_1',
      },
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

  it('fails validation when checkout completion buyer details are missing', async () => {
    const fetchImpl = vi.fn();

    const result = await completeAgenticCheckoutSession(
      {
        idempotency_key: 'idem-complete-1',
        payment_data: {
          provider: 'pay_on_delivery',
        },
        session_id: 'agentic_session_1',
      } as Parameters<typeof completeAgenticCheckoutSession>[0],
      {
        apiBaseUrl: 'https://ogabassey.com',
        apiKey: 'agentic-api-key',
        fetchImpl,
        signingKey: 'signing-secret',
      }
    );

    expect(result).toMatchObject({
      error: 'Invalid checkout session complete input',
      ok: false,
      status: 400,
    });
    if (result.ok) {
      throw new Error('Expected checkout completion validation to fail');
    }
    expect(result.details).toMatchObject({
      fieldErrors: {
        buyer: expect.any(Array),
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns completion route errors with request recovery details', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'CONFIRMATION_REQUIRED' }), {
        status: 402,
      })
    );

    const result = await completeAgenticCheckoutSession(
      {
        buyer: {
          email: 'buyer@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          phone_number: '+2348012345678',
        },
        idempotency_key: 'idem-complete-1',
        payment_data: {
          provider: 'pay_on_delivery',
        },
        session_id: 'agentic_session_1',
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
      endpoint:
        'https://ogabassey.com/api/agentic/checkout_sessions/agentic_session_1/complete',
      error: 'CONFIRMATION_REQUIRED',
      idempotencyKey: 'idem-complete-1',
      ok: false,
      requestId: 'request-1',
      status: 402,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('signing-secret');
  });
});
