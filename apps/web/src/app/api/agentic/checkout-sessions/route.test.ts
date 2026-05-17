import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPostCheckoutSession } = vi.hoisted(() => ({
  mockPostCheckoutSession: vi.fn(),
}));

vi.mock('../checkout_sessions/route', () => ({
  handleAgenticCheckoutSessionCreate: mockPostCheckoutSession,
  POST: vi.fn(),
}));

describe('POST /api/agentic/checkout-sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostCheckoutSession.mockResolvedValue(
      NextResponse.json(
        {
          id: 'agentic_session_1',
          line_items: [],
          links: [],
          status: 'ready_for_payment',
          totals: [],
        },
        { status: 201 }
      )
    );
  });

  it('passes a UCP request adapter into the legacy checkout create handler', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout-sessions',
      {
        body: JSON.stringify({ line_items: [] }),
        method: 'POST',
      }
    );

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(mockPostCheckoutSession).toHaveBeenCalledWith(request, {
      requestBodyAdapter: expect.any(Function),
    });
    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      status: 'ready_for_complete',
      ucp: {
        capabilities: {
          'dev.ucp.shopping.checkout': [{ version: '2026-04-08' }],
        },
      },
    });
  });
});
