import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { createServiceClient } from '@/lib/supabase/service';

const mockVerifyAgenticApiKey = vi.fn(() => true);

vi.mock('@/lib/agentic/auth', () => ({
  verifyAgenticApiKey: mockVerifyAgenticApiKey,
}));

vi.mock('@/lib/agentic/checkout', () => ({
  calculateCheckoutSession: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
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

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid JSON body' });
  });

  it('updates an existing checkout session successfully', async () => {
    const updateSpy = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'checkout_sessions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'session-1',
                    status: 'in_progress',
                    items: [{ id: 'product-1', quantity: 1 }],
                    currency: 'NGN',
                    fulfillment_option_id: 'pickup_store_1',
                    fulfillment_address: null,
                  },
                  error: null,
                }),
              })),
            })),
            update: updateSpy,
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
          type: 'shipping',
          id: 'shipping_standard',
          title: 'Standard Delivery',
          subtitle: 'Delivery within Lagos',
          subtotal: 2500,
          tax: 0,
          total: 2500,
        },
      ],
      selectedOptionId: 'shipping_standard',
      messages: [],
    });

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/session-1',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipping_address: {
            address: '12 Example Street',
            city: 'Lagos',
          },
          fulfillment_option_id: 'shipping_standard',
        }),
      }
    );
    const params = { params: Promise.resolve({ id: 'session-1' }) };

    const { POST } = await import('./route');
    const response = await POST(request, params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: 'session-1',
      status: 'ready_for_payment',
      fulfillment_option_id: 'shipping_standard',
      shipping_address: {
        address: '12 Example Street',
        city: 'Lagos',
      },
    });
    expect(calculateCheckoutSession).toHaveBeenCalledWith(
      mockSupabase,
      [{ id: 'product-1', quantity: 1 }],
      'shipping_standard',
      'NGN'
    );
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fulfillment_option_id: 'shipping_standard',
        status: 'ready_for_payment',
      })
    );
  });
});
