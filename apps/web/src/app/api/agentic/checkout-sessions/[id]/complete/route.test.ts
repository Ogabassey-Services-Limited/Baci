import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCompleteCheckoutSession } = vi.hoisted(() => ({
  mockCompleteCheckoutSession: vi.fn(),
}));

vi.mock('@/app/api/agentic/checkout_sessions/[id]/complete/route', () => ({
  POST: mockCompleteCheckoutSession,
}));

const routeProps = { params: Promise.resolve({ id: 'agentic_session_1' }) };

describe('POST /api/agentic/checkout-sessions/[id]/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompleteCheckoutSession.mockResolvedValue(
      NextResponse.json({
        id: 'agentic_session_1',
        line_items: [],
        links: [],
        status: 'completed',
        totals: [],
      })
    );
  });

  it('adapts successful complete responses to UCP checkout payloads', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout-sessions/agentic_session_1/complete',
      { method: 'POST' }
    );

    const { POST } = await import('./route');
    const response = await POST(request, routeProps);
    const body = await response.json();

    expect(mockCompleteCheckoutSession).toHaveBeenCalledWith(
      request,
      routeProps
    );
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: 'agentic_session_1',
      status: 'completed',
      ucp: {
        capabilities: {
          'dev.ucp.shopping.checkout': [{ version: '2026-04-08' }],
        },
      },
    });
  });

  it('passes through delegated complete errors without adapting them', async () => {
    mockCompleteCheckoutSession.mockResolvedValueOnce(
      NextResponse.json({ error: 'Conflict' }, { status: 409 })
    );
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout-sessions/agentic_session_1/complete',
      { method: 'POST' }
    );

    const { POST } = await import('./route');
    const response = await POST(request, routeProps);

    expect(mockCompleteCheckoutSession).toHaveBeenCalledWith(
      request,
      routeProps
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Conflict' });
  });
});
