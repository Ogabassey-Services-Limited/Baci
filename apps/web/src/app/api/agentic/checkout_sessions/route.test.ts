import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import {
  reserveAgenticIdempotencyKey,
  storeAgenticIdempotencyResponse,
} from '@/lib/agentic/idempotency';
import { reserveAgenticRequestId } from '@/lib/agentic/request-replay';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

const mockGetIdempotencyKey = vi.fn(() => 'idem-1');
const mockResolveAgenticMerchantContext = vi.fn(() =>
  Promise.resolve({ id: 'merchant-1', slug: 'ogabassey' })
);
const mockVerifyAgenticApiKey = vi.fn(() => true);

vi.mock('@/lib/agentic/auth', () => ({
  getIdempotencyKey: mockGetIdempotencyKey,
  verifyAgenticApiKey: mockVerifyAgenticApiKey,
}));

vi.mock('@/lib/agentic/checkout', () => ({
  calculateCheckoutSession: vi.fn(),
}));

vi.mock('@/lib/agentic/idempotency', () => ({
  reserveAgenticIdempotencyKey: vi.fn(),
  storeAgenticIdempotencyResponse: vi.fn(),
}));

vi.mock('@/lib/agentic/merchant-context', () => ({
  resolveAgenticMerchantContext: mockResolveAgenticMerchantContext,
}));

vi.mock('@/lib/agentic/request-integrity', () => ({
  getAgenticSigningSecrets: vi.fn(() => ['signing-secret']),
  verifyAgenticRequestIntegrity: vi.fn(() => ({
    apiVersion: '2026-04-30',
    ok: true,
    requestId: 'req_123',
  })),
}));

vi.mock('@/lib/agentic/request-replay', () => ({
  reserveAgenticRequestId: vi.fn(),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}));

describe('POST /api/agentic/checkout_sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIdempotencyKey.mockReturnValue('idem-1');
    mockResolveAgenticMerchantContext.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockVerifyAgenticApiKey.mockReturnValue(true);
    vi.mocked(reserveAgenticIdempotencyKey).mockResolvedValue({
      ok: true,
      state: 'reserved',
    });
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.mocked(reserveAgenticRequestId).mockResolvedValue({ ok: true });
  });

  it('returns 400 when the request body cannot be parsed', async () => {
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
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
    const insertSpy = vi.fn((_: Record<string, unknown>) => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: 'row-1', session_id: 'agentic_session_1' },
          error: null,
        }),
      })),
    }));
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'checkout_sessions') {
          return {
            insert: insertSpy,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never);
    vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue(
      mockSupabase as never
    );
    vi.mocked(calculateCheckoutSession).mockResolvedValue({
      lineItems: [
        {
          id: 'line_product-1',
          item: {
            id: 'product-1',
            product_id: 'product-1',
            quantity: 1,
            title: 'Phone',
          },
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
    expect(body).toMatchObject({
      id: 'agentic_session_1',
      status: 'not_ready_for_payment',
      currency: 'ngn',
      line_items: expect.any(Array),
      shipping_address: null,
    });
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cart_items: [{ id: 'product-1', quantity: 1 }],
        currency: 'NGN',
        merchant_id: 'merchant-1',
        session_id: expect.stringMatching(/^agentic_/),
        status: 'pending',
      })
    );
    const insertPayload = insertSpy.mock.calls[0]?.[0];
    expect(insertPayload).toBeDefined();
    expect(insertPayload).not.toHaveProperty('items');
    expect(insertPayload).not.toHaveProperty('line_items');
    expect(insertPayload).not.toHaveProperty('fulfillment_address');
    expect(insertPayload?.metadata).toMatchObject({
      agentic: {
        fulfillment_options: expect.any(Array),
        line_items: expect.any(Array),
        messages: [],
        totals: expect.any(Array),
      },
    });
  });

  it('returns a recoverable error when idempotency response storage fails', async () => {
    const errorSpy = vi
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);
    const insertSpy = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: 'row-1', session_id: 'agentic_session_1' },
          error: null,
        }),
      })),
    }));
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'checkout_sessions') {
          return { insert: insertSpy };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never);
    vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue(
      mockSupabase as never
    );
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValueOnce({
      error: new Error('idempotency write failed'),
      ok: false,
    });
    vi.mocked(calculateCheckoutSession).mockResolvedValue({
      fulfillmentOptions: [],
      lineItems: [],
      messages: [],
      selectedOptionId: undefined,
      totals: [{ amount: 0, display_text: 'Total Due', type: 'total' }],
    });

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions',
      {
        body: JSON.stringify({ items: [{ id: 'product-1', quantity: 1 }] }),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
        },
        method: 'POST',
      }
    );

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: 'Idempotency response storage failed',
      idempotency_key: 'idem-1',
      recovery_action: 'read_checkout_session',
      session_id: 'agentic_session_1',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to store agentic checkout idempotency response',
        idempotencyKey: 'idem-1',
        merchantId: 'merchant-1',
        route: 'checkout_sessions.create',
      })
    );
    errorSpy.mockRestore();
  });
});
