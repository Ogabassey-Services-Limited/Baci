import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetIdempotencyKey = vi.fn(() => 'idem-1');
const mockVerifyAgenticApiKey = vi.fn(() => true);
const mockCalculateCheckoutSession = vi.fn();
const mockSingle = vi.fn();
const mockInsertSingle = vi.fn();

vi.mock('@/lib/agentic/auth', () => ({
  getIdempotencyKey: mockGetIdempotencyKey,
  verifyAgenticApiKey: mockVerifyAgenticApiKey,
}));

vi.mock('@/lib/agentic/checkout', () => ({
  calculateCheckoutSession: mockCalculateCheckoutSession,
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSingle,
            })),
          })),
        };
      }
      // checkout_sessions table
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockInsertSingle,
          })),
        })),
      };
    }),
  })),
}));

describe('POST /api/agentic/checkout_sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAgenticApiKey.mockReturnValue(true);
  });

  it('returns 400 when the request body cannot be parsed', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{invalid-json',
      }
    );

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(mockVerifyAgenticApiKey).toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid request body' });
  });

  it('returns 401 when API key verification fails', async () => {
    mockVerifyAgenticApiKey.mockReturnValue(false);

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ product_id: 'p-1', quantity: 1 }] }),
      }
    );

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when items array is missing or empty', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      }
    );

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Items array is required' });
  });

  it('returns 500 when the default merchant is not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ product_id: 'p-1', quantity: 1 }] }),
      }
    );

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Default merchant not found' });
  });
});
