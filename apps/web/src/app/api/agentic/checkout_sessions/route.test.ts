import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { createServiceClient } from '@/lib/supabase/service';

const mockGetIdempotencyKey = vi.fn(() => 'idem-1');
const mockVerifyAgenticApiKey = vi.fn(() => true);

vi.mock('@/lib/agentic/auth', () => ({
  getIdempotencyKey: mockGetIdempotencyKey,
  verifyAgenticApiKey: mockVerifyAgenticApiKey,
}));

vi.mock('@/lib/agentic/checkout', () => ({
  calculateCheckoutSession: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}));

describe('POST /api/agentic/checkout_sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIdempotencyKey.mockReturnValue('idem-1');
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

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 401 when API key verification fails and skips downstream work', async () => {
    mockVerifyAgenticApiKey.mockReturnValue(false);

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: 'p-1', quantity: 1 }] }),
      }
    );

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(calculateCheckoutSession).not.toHaveBeenCalled();
  });

  it('creates a checkout session and returns the idempotency header', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'merchant-1', business_name: 'Ogabassey' },
                }),
              })),
            })),
          };
        }

        if (table === 'checkout_sessions') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'session-1' },
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never);
    vi.mocked(calculateCheckoutSession).mockResolvedValue({
      lineItems: [
        {
          id: 'line_product-1',
          item: { id: 'product-1', quantity: 1, title: 'Phone' },
          base_amount: 500000,
          discount: 0,
          subtotal: 500000,
          tax: 0,
          total: 500000,
        },
      ],
      totals: [{ type: 'total', display_text: 'Total Due', amount: 500000 }],
      fulfillmentOptions: [
        {
          type: 'pickup',
          id: 'pickup_store_1',
          title: 'Store Pickup',
          subtotal: 0,
          tax: 0,
          total: 0,
        },
      ],
      selectedOptionId: 'pickup_store_1',
      messages: [],
    });

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
        },
        body: JSON.stringify({
          items: [{ id: 'product-1', quantity: 1 }],
          currency: 'ngn',
        }),
      }
    );

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get('idempotency-key')).toBe('idem-1');
    expect(mockGetIdempotencyKey).toHaveBeenCalled();
    expect(body).toMatchObject({
      id: 'session-1',
      status: 'not_ready_for_payment',
      currency: 'ngn',
      line_items: expect.any(Array),
    });
  });
});
