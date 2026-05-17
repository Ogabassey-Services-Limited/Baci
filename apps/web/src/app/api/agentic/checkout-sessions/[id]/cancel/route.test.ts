import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCancelCheckoutSession } = vi.hoisted(() => ({
  mockCancelCheckoutSession: vi.fn(),
}));

vi.mock('@/app/api/agentic/checkout_sessions/[id]/cancel/route', () => ({
  POST: mockCancelCheckoutSession,
}));

const routeProps = { params: Promise.resolve({ id: 'agentic_session_1' }) };

describe('POST /api/agentic/checkout-sessions/[id]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCancelCheckoutSession.mockResolvedValue(
      NextResponse.json({
        id: 'agentic_session_1',
        line_items: [],
        links: [],
        status: 'canceled',
        totals: [],
      })
    );
  });

  it('adapts successful cancel responses to UCP checkout payloads', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout-sessions/agentic_session_1/cancel',
      { method: 'POST' }
    );

    const { POST } = await import('./route');
    const response = await POST(request, routeProps);
    const body = await response.json();

    expect(mockCancelCheckoutSession).toHaveBeenCalledWith(request, routeProps);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: 'agentic_session_1',
      status: 'canceled',
      ucp: {
        capabilities: {
          'dev.ucp.shopping.checkout': [{ version: '2026-04-08' }],
        },
      },
    });
  });

  it('adapts delegated cancel errors to UCP error payloads', async () => {
    mockCancelCheckoutSession.mockResolvedValueOnce(
      NextResponse.json({ error: 'Conflict' }, { status: 409 })
    );
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout-sessions/agentic_session_1/cancel',
      { method: 'POST' }
    );

    const { POST } = await import('./route');
    const response = await POST(request, routeProps);

    expect(mockCancelCheckoutSession).toHaveBeenCalledWith(request, routeProps);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'Conflict',
      messages: [
        {
          content: 'Conflict',
          content_type: 'plain',
          type: 'error',
        },
      ],
      ucp: {
        status: 'error',
      },
    });
  });
});
