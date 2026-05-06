import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAgenticMutationRequest } from '@/lib/agentic/mutation-request';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { createAdminClient } from '@/lib/supabase/admin';

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
vi.mock('@/lib/agentic/merchant-context', () => ({
  resolveAgenticMerchantContext: mockResolveAgenticMerchantContext,
}));
vi.mock('@/lib/agentic/mutation-request', () => ({
  readAgenticMutationRequest: mockReadAgenticMutationRequest,
}));
vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

const orderId = '11111111-1111-4111-8111-111111111111';

const orderRow = {
  created_at: '2026-04-28T12:00:00.000Z',
  id: orderId,
  payment_status: 'pending',
  shipping_status: 'pending',
  status: 'pending',
  tracking_number: null,
  updated_at: '2026-04-28T12:00:00.000Z',
};

function request() {
  return new NextRequest(
    `https://ogabassey.com/api/agentic/orders/${orderId}`,
    {
      headers: { authorization: 'Bearer test' },
    }
  );
}

function routeParams(id = orderId) {
  return { params: Promise.resolve({ id }) };
}

function mockOrderRead({
  data,
  error = null,
}: {
  data: Record<string, unknown> | null;
  error?: unknown;
}) {
  const orderChain = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  orderChain.eq.mockReturnValue(orderChain);
  const scopedSupabase = {
    from: vi.fn((table: string) => {
      if (table === 'orders') return { select: vi.fn(() => orderChain) };
      throw new Error(`Unexpected scoped table ${table}`);
    }),
  };
  vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue(
    scopedSupabase as never
  );
  return { orderChain, scopedSupabase };
}

describe('GET /api/agentic/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAgenticApiKey.mockReturnValue(true);
    mockResolveAgenticMerchantContext.mockResolvedValue({
      custom_domain: 'ogabassey.com',
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockReadAgenticMutationRequest.mockResolvedValue({
      apiVersion: '2026-04-30',
      body: {},
      idempotencyKey: '',
      method: 'GET',
      ok: true,
      pathname: `/api/agentic/orders/${orderId}`,
      rawBody: '',
      requestId: 'req_123',
    });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(),
    } as never);
  });

  it('returns public post-purchase order state for an agentic order', async () => {
    const { orderChain } = mockOrderRead({ data: orderRow });

    const { GET } = await import('./route');
    const response = await GET(request(), routeParams());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...orderRow,
      links: {
        support: 'https://ogabassey.com/contact',
        track_order: 'https://ogabassey.com/track-order',
      },
    });
    expect(orderChain.eq).toHaveBeenCalledWith('id', orderId);
    expect(orderChain.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(orderChain.eq).toHaveBeenCalledWith('source', 'agentic_ai');
  });

  it('returns 401 when API key verification fails', async () => {
    mockVerifyAgenticApiKey.mockReturnValue(false);

    const { GET } = await import('./route');
    const response = await GET(request(), routeParams());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(readAgenticMutationRequest).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(createAgenticScopedSupabaseClient).not.toHaveBeenCalled();
  });

  it('requires signed read integrity without requiring idempotency', async () => {
    mockReadAgenticMutationRequest.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      ),
    });

    const { GET } = await import('./route');
    const response = await GET(request(), routeParams());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Invalid signature' });
    expect(readAgenticMutationRequest).toHaveBeenCalledWith({
      request: expect.any(NextRequest),
      requireIdempotency: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('returns 400 before DB access when the order id route param is invalid', async () => {
    const { GET } = await import('./route');
    const response = await GET(request(), routeParams('../order-1'));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'Invalid route params',
    });
    expect(readAgenticMutationRequest).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('returns 500 when the configured agentic merchant cannot be resolved', async () => {
    mockResolveAgenticMerchantContext.mockResolvedValueOnce(null);

    const { GET } = await import('./route');
    const response = await GET(request(), routeParams());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Agentic merchant not found',
    });
    expect(createAgenticScopedSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns 404 when the scoped agentic order is not found', async () => {
    mockOrderRead({ data: null });

    const { GET } = await import('./route');
    const response = await GET(request(), routeParams());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Order not found' });
  });

  it('returns 500 when the scoped order query fails', async () => {
    mockOrderRead({
      data: null,
      error: { message: 'db unavailable' },
    });

    const { GET } = await import('./route');
    const response = await GET(request(), routeParams());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to fetch order' });
  });

  it('does not use a service-role bypass client for order data reads', async () => {
    const adminSupabase = { from: vi.fn() };
    vi.mocked(createAdminClient).mockReturnValue(adminSupabase as never);
    const { scopedSupabase } = mockOrderRead({ data: orderRow });

    const { GET } = await import('./route');
    const response = await GET(request(), routeParams());

    expect(response.status).toBe(200);
    expect(adminSupabase.from).not.toHaveBeenCalled();
    expect(scopedSupabase.from).toHaveBeenCalledWith('orders');
    expect(createAgenticScopedSupabaseClient).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
    });
  });
});
