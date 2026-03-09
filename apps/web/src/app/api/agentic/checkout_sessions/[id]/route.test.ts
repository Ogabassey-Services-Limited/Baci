import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockVerifyAgenticApiKey = vi.fn(() => true);
const mockSingle = vi.fn();
const mockCalculateCheckoutSession = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: vi.fn() }));

vi.mock('@/lib/agentic/auth', () => ({
  verifyAgenticApiKey: mockVerifyAgenticApiKey,
}));

vi.mock('@/lib/agentic/checkout', () => ({
  calculateCheckoutSession: mockCalculateCheckoutSession,
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
      update: mockUpdate,
    })),
  })),
}));

describe('POST /api/agentic/checkout_sessions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAgenticApiKey.mockReturnValue(true);
  });

  it('returns 400 when the request body cannot be parsed', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/session-1',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{invalid-json',
      }
    );
    const params = { params: Promise.resolve({ id: 'session-1' }) };

    const { POST } = await import('./route');
    const response = await POST(request, params);
    const body = await response.json();

    expect(mockVerifyAgenticApiKey).toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid request body' });
  });

  it('returns 401 when API key verification fails', async () => {
    mockVerifyAgenticApiKey.mockReturnValue(false);

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/session-1',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      }
    );
    const params = { params: Promise.resolve({ id: 'session-1' }) };

    const { POST } = await import('./route');
    const response = await POST(request, params);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 404 when session is not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/session-1',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ product_id: 'p-1', quantity: 1 }] }),
      }
    );
    const params = { params: Promise.resolve({ id: 'session-1' }) };

    const { POST } = await import('./route');
    const response = await POST(request, params);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Session not found' });
  });
});

describe('GET /api/agentic/checkout_sessions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAgenticApiKey.mockReturnValue(true);
  });

  it('returns 401 when API key verification fails', async () => {
    mockVerifyAgenticApiKey.mockReturnValue(false);

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/session-1'
    );
    const params = { params: Promise.resolve({ id: 'session-1' }) };

    const { GET } = await import('./route');
    const response = await GET(request, params);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 404 when session is not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/session-1'
    );
    const params = { params: Promise.resolve({ id: 'session-1' }) };

    const { GET } = await import('./route');
    const response = await GET(request, params);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Session not found' });
  });

  it('returns session data on successful retrieval', async () => {
    const mockSession = {
      id: 'session-1',
      status: 'in_progress',
      items: [{ product_id: 'p-1', quantity: 2 }],
      fulfillment_option_id: null,
      currency: 'NGN',
      fulfillment_address: null,
    };

    mockSingle.mockResolvedValueOnce({ data: mockSession, error: null });
    mockCalculateCheckoutSession.mockResolvedValueOnce({
      lineItems: [
        { name: 'Product', quantity: 2, unitPrice: 1000, total: 2000 },
      ],
      totals: { subtotal: 2000, total: 2000 },
      fulfillmentOptions: [],
      messages: [],
    });

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/session-1'
    );
    const params = { params: Promise.resolve({ id: 'session-1' }) };

    const { GET } = await import('./route');
    const response = await GET(request, params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe('session-1');
    expect(body.status).toBe('in_progress');
    expect(body.currency).toBe('ngn');
    expect(body.line_items).toHaveLength(1);
  });
});
