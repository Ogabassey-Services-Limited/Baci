import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import {
  reserveAgenticIdempotencyKey,
  storeAgenticIdempotencyResponse,
} from '@/lib/agentic/idempotency';
import { reserveAgenticRequestId } from '@/lib/agentic/request-replay';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { createServiceClient } from '@/lib/supabase/service';

const mockVerifyAgenticApiKey = vi.fn(() => true);
const mockResolveAgenticMerchantContext = vi.fn(() =>
  Promise.resolve({ id: 'merchant-1', slug: 'ogabassey' })
);

vi.mock('@/lib/agentic/auth', () => ({
  verifyAgenticApiKey: mockVerifyAgenticApiKey,
}));

vi.mock('@/lib/agentic/merchant-context', () => ({
  resolveAgenticMerchantContext: mockResolveAgenticMerchantContext,
}));

vi.mock('@/lib/agentic/checkout', () => ({
  calculateCheckoutSession: vi.fn(),
}));

vi.mock('@/lib/agentic/idempotency', () => ({
  reserveAgenticIdempotencyKey: vi.fn(),
  storeAgenticIdempotencyResponse: vi.fn(),
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

describe('POST /api/agentic/checkout_sessions/[id] payment state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAgenticApiKey.mockReturnValue(true);
    mockResolveAgenticMerchantContext.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    vi.mocked(reserveAgenticIdempotencyKey).mockResolvedValue({
      ok: true,
      state: 'reserved',
    });
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: null,
      ok: true,
    });
    vi.mocked(reserveAgenticRequestId).mockResolvedValue({ ok: true });
  });

  it('rejects updates after payment setup has started', async () => {
    const updateSpy = vi.fn();

    const readChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'session-1',
          session_id: 'agentic_session_1',
          status: 'processing',
          cart_items: [{ id: 'product-1', quantity: 1 }],
          currency: 'NGN',
          shipping_method: 'pickup_store_1',
          shipping_address: { city: 'Lagos' },
          order_id: 'order-1',
          payment_reference: '1234567890',
          virtual_account_number: '1234567890',
          metadata: {
            agentic: { payment_state: 'payment_pending' },
          },
        },
        error: null,
      }),
    };
    readChain.eq.mockReturnValue(readChain);

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'checkout_sessions') {
          return {
            select: vi.fn(() => readChain),
            update: updateSpy,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };
    vi.mocked(createServiceClient).mockReturnValue(supabase as never);
    vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue(
      supabase as never
    );

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/agentic_session_1',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
        },
        body: JSON.stringify({
          shipping_address: { city: 'Abuja' },
        }),
      }
    );
    const params = { params: Promise.resolve({ id: 'agentic_session_1' }) };

    const { POST } = await import('./route');
    const response = await POST(request, params);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'Session already has pending payment',
      status: 'payment_pending',
    });
    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'idem-1',
        response: {
          error: 'Session already has pending payment',
          status: 'payment_pending',
        },
        route: 'checkout_sessions.update',
        status: 409,
      })
    );
    expect(updateSpy).not.toHaveBeenCalled();
    expect(calculateCheckoutSession).not.toHaveBeenCalled();
  });
});
