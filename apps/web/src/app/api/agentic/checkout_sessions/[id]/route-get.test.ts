import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { readAgenticMutationRequest } from '@/lib/agentic/mutation-request';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { createServiceClient } from '@/lib/supabase/service';

const {
  mockReadAgenticMutationRequest,
  mockResolveAgenticMerchantContext,
  mockVerifyAgenticApiKey,
} = vi.hoisted(() => ({
  mockReadAgenticMutationRequest: vi.fn(),
  mockResolveAgenticMerchantContext: vi.fn(),
  mockVerifyAgenticApiKey: vi.fn(() => true),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/agentic/auth', () => ({
  verifyAgenticApiKey: mockVerifyAgenticApiKey,
}));
vi.mock('@/lib/agentic/checkout', () => ({
  calculateCheckoutSession: vi.fn(),
}));
vi.mock('@/lib/agentic/merchant-context', () => ({
  resolveAgenticMerchantContext: mockResolveAgenticMerchantContext,
}));
vi.mock('@/lib/agentic/mutation-request', () => ({
  readAgenticMutationRequest: mockReadAgenticMutationRequest,
}));
vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: vi.fn(),
}));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));

function routeParams() {
  return { params: Promise.resolve({ id: 'agentic_session_1' }) };
}

function mockCheckoutSessionRead(session: Record<string, unknown> | null) {
  const readChain = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: session, error: null }),
  };
  readChain.eq.mockReturnValue(readChain);
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'checkout_sessions')
        return { select: vi.fn(() => readChain) };
      throw new Error(`Unexpected table ${table}`);
    }),
  };
  vi.mocked(createServiceClient).mockReturnValue(supabase as never);
  vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue(
    supabase as never
  );
}

describe('GET /api/agentic/checkout_sessions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAgenticApiKey.mockReturnValue(true);
    mockResolveAgenticMerchantContext.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockReadAgenticMutationRequest.mockResolvedValue({
      apiVersion: '2026-04-30',
      body: {},
      idempotencyKey: '',
      method: 'GET',
      ok: true,
      pathname: '/api/agentic/checkout_sessions/agentic_session_1',
      rawBody: '',
      requestId: 'req_123',
    });
  });

  it('returns 401 when API key verification fails and skips DB calls', async () => {
    mockVerifyAgenticApiKey.mockReturnValue(false);

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/agentic_session_1'
    );

    const { GET } = await import('./route');
    const response = await GET(request, routeParams());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(readAgenticMutationRequest).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(calculateCheckoutSession).not.toHaveBeenCalled();
  });

  it('requires signed request integrity without requiring idempotency for reads', async () => {
    mockReadAgenticMutationRequest.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      ),
    });

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/agentic_session_1'
    );

    const { GET } = await import('./route');
    const response = await GET(request, routeParams());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Invalid signature' });
    expect(readAgenticMutationRequest).toHaveBeenCalledWith({
      request,
      requireIdempotency: false,
    });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(calculateCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 500 when stored cart items are malformed', async () => {
    mockCheckoutSessionRead({
      session_id: 'agentic_session_1',
      status: 'processing',
      cart_items: [{ id: '', quantity: 0 }],
      currency: 'NGN',
      shipping_method: 'pickup_store_1',
      shipping_address: { city: 'Lagos' },
      order_id: null,
      payment_reference: null,
      virtual_account_number: null,
      metadata: null,
    });

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/agentic_session_1'
    );

    const { GET } = await import('./route');
    const response = await GET(request, routeParams());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Invalid session cart items' });
    expect(calculateCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 500 when checkout calculation fails', async () => {
    mockCheckoutSessionRead({
      session_id: 'agentic_session_1',
      status: 'processing',
      cart_items: [{ id: 'product-1', quantity: 1 }],
      currency: 'NGN',
      shipping_method: 'pickup_store_1',
      shipping_address: { city: 'Lagos' },
      order_id: null,
      payment_reference: null,
      virtual_account_number: null,
      metadata: null,
    });
    vi.mocked(calculateCheckoutSession).mockRejectedValue(
      new Error('calculation failed')
    );

    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/agentic_session_1'
    );

    const { GET } = await import('./route');
    const response = await GET(request, routeParams());
    const body = await response.json();

    expect(calculateCheckoutSession).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Checkout calculation failed' });
  });
});
