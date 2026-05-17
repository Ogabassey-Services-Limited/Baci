import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetCheckoutSession,
  mockPostCheckoutSession,
  mockPutCheckoutSession,
} = vi.hoisted(() => ({
  mockGetCheckoutSession: vi.fn(),
  mockPostCheckoutSession: vi.fn(),
  mockPutCheckoutSession: vi.fn(),
}));

vi.mock('../../checkout_sessions/[id]/route', () => ({
  GET: mockGetCheckoutSession,
  POST: mockPostCheckoutSession,
  PUT: mockPutCheckoutSession,
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
    mockPostCheckoutSession.mockResolvedValue(
      NextResponse.json({
        id: 'agentic_session_1',
        line_items: [],
        links: [],
        status: 'ready_for_payment',
        totals: [],
      })
    );
    mockPutCheckoutSession.mockResolvedValue(
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

    expect(mockPutCheckoutSession).toHaveBeenCalledWith(request, routeProps, {
      requestBodyAdapter: expect.any(Function),
    });
    expect(response.status).toBe(200);
    expect(body.status).toBe('ready_for_complete');
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
