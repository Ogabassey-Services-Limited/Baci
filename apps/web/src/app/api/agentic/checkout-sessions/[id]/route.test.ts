import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCheckoutSession, mockHandleCheckoutSessionUpdate } = vi.hoisted(
  () => ({
    mockGetCheckoutSession: vi.fn(),
    mockHandleCheckoutSessionUpdate: vi.fn(),
  })
);

vi.mock('@/app/api/agentic/checkout_sessions/[id]/route', () => ({
  GET: mockGetCheckoutSession,
  handleAgenticCheckoutSessionUpdate: mockHandleCheckoutSessionUpdate,
}));

const routeProps = { params: Promise.resolve({ id: 'agentic_session_1' }) };

describe('/api/agentic/checkout-sessions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCheckoutSession.mockResolvedValue(
      NextResponse.json({
        id: 'agentic_session_1',
        line_items: [],
        links: [],
        status: 'ready_for_payment',
        totals: [],
      })
    );
    mockHandleCheckoutSessionUpdate.mockResolvedValue(
      NextResponse.json({
        id: 'agentic_session_1',
        line_items: [],
        links: [],
        status: 'ready_for_payment',
        totals: [],
      })
    );
  });

  it('passes a UCP request adapter into PUT checkout updates', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout-sessions/agentic_session_1',
      {
        body: JSON.stringify({ line_items: [] }),
        method: 'PUT',
      }
    );

    const { PUT } = await import('./route');
    const response = await PUT(request, routeProps);
    const body = await response.json();

    expect(mockHandleCheckoutSessionUpdate).toHaveBeenCalledWith(
      request,
      routeProps,
      {
        requestBodyAdapter: expect.any(Function),
      }
    );
    expect(response.status).toBe(200);
    expect(body.status).toBe('ready_for_complete');
  });

  it('passes a UCP request adapter into POST checkout updates', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout-sessions/agentic_session_1',
      {
        body: JSON.stringify({ line_items: [] }),
        method: 'POST',
      }
    );

    const { POST } = await import('./route');
    const response = await POST(request, routeProps);
    const body = await response.json();

    expect(mockHandleCheckoutSessionUpdate).toHaveBeenCalledWith(
      request,
      routeProps,
      {
        requestBodyAdapter: expect.any(Function),
      }
    );
    expect(response.status).toBe(200);
    expect(body.status).toBe('ready_for_complete');
  });

  it('adapts delegated POST errors to UCP error payloads', async () => {
    mockHandleCheckoutSessionUpdate.mockResolvedValueOnce(
      NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    );
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout-sessions/agentic_session_1',
      {
        body: JSON.stringify({ line_items: [] }),
        method: 'POST',
      }
    );

    const { POST } = await import('./route');
    const response = await POST(request, routeProps);

    expect(mockHandleCheckoutSessionUpdate).toHaveBeenCalledWith(
      request,
      routeProps,
      {
        requestBodyAdapter: expect.any(Function),
      }
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'Invalid request body',
      messages: [
        {
          content: 'Invalid request body',
          content_type: 'plain',
          type: 'error',
        },
      ],
      ucp: {
        status: 'error',
      },
    });
  });

  it('keeps GET read-only and only adapts the response', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout-sessions/agentic_session_1'
    );

    const { GET } = await import('./route');
    const response = await GET(request, routeProps);
    const body = await response.json();

    expect(mockGetCheckoutSession).toHaveBeenCalledWith(request, routeProps);
    expect(body.ucp).toMatchObject({
      capabilities: {
        'dev.ucp.shopping.checkout': [{ version: '2026-04-08' }],
      },
    });
  });
});
