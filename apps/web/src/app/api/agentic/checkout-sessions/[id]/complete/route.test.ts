import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHandleAgenticCheckoutSessionComplete } = vi.hoisted(() => ({
  mockHandleAgenticCheckoutSessionComplete: vi.fn(),
}));

vi.mock('@/app/api/agentic/checkout_sessions/[id]/complete/route', () => ({
  handleAgenticCheckoutSessionComplete:
    mockHandleAgenticCheckoutSessionComplete,
}));

const routeProps = { params: Promise.resolve({ id: 'agentic_session_1' }) };

describe('POST /api/agentic/checkout-sessions/[id]/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleAgenticCheckoutSessionComplete.mockResolvedValue(
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

    expect(mockHandleAgenticCheckoutSessionComplete).toHaveBeenCalledWith(
      request,
      routeProps,
      { requestBodyAdapter: expect.any(Function) }
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

  it('delegates with a complete request adapter', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout-sessions/agentic_session_1/complete',
      { method: 'POST' }
    );

    const { POST } = await import('./route');
    await POST(request, routeProps);
    const options = mockHandleAgenticCheckoutSessionComplete.mock.calls[0]?.[2];

    expect(options?.requestBodyAdapter).toEqual(expect.any(Function));
  });

  it('adapts delegated complete errors to UCP error payloads', async () => {
    mockHandleAgenticCheckoutSessionComplete.mockResolvedValueOnce(
      NextResponse.json({ error: 'Conflict' }, { status: 409 })
    );
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout-sessions/agentic_session_1/complete',
      { method: 'POST' }
    );

    const { POST } = await import('./route');
    const response = await POST(request, routeProps);

    expect(mockHandleAgenticCheckoutSessionComplete).toHaveBeenCalledWith(
      request,
      routeProps,
      { requestBodyAdapter: expect.any(Function) }
    );
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
        capabilities: {
          'dev.ucp.shopping.checkout': [{ version: '2026-04-08' }],
        },
        status: 'error',
      },
    });
  });
});
