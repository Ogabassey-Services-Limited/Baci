import type { SupabaseClient } from '@supabase/supabase-js';
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

const mockResolveAgenticMerchantContext = vi.fn(() =>
  Promise.resolve({ id: 'merchant-1', slug: 'ogabassey' })
);
const mockVerifyAgenticApiKey = vi.fn(() => true);

vi.mock('@/lib/agentic/auth', () => ({
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
  AGENTIC_REQUEST_INTEGRITY_ERRORS: {
    INVALID_REQUEST_ID_FORMAT: 'Invalid request ID format',
    INVALID_TIMESTAMP: 'Invalid timestamp',
    MISSING_SIGNING_SECRET: 'Missing signing secret',
    REQUEST_ID_TOO_LONG: 'Request ID too long',
    STALE_TIMESTAMP: 'Stale timestamp',
    UNSUPPORTED_API_VERSION: 'Unsupported api version',
  },
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
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));

const session = {
  id: 'session-row-1',
  session_id: 'agentic_session_1',
  merchant_id: 'merchant-1',
  status: 'pending',
  cart_items: [{ id: 'product-1', quantity: 1 }],
  currency: 'NGN',
  shipping_method: 'pickup_store_1',
  shipping_address: null,
  order_id: null,
  payment_reference: null,
  virtual_account_number: null,
  metadata: null,
};

const sessionCalc = {
  lineItems: [
    {
      id: 'line_product-1',
      item: {
        id: 'product-1',
        product_id: 'product-1',
        quantity: 1,
        title: 'Phone',
      },
      base_amount: 500_000,
      discount: 0,
      subtotal: 500_000,
      tax: 0,
      total: 500_000,
    },
  ],
  totals: [
    { type: 'total' as const, display_text: 'Total Due', amount: 500_000 },
  ],
  fulfillmentOptions: [
    {
      type: 'shipping' as const,
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
};

function createCheckoutSupabaseMock({
  readError = null,
  readSession = session,
  updateData = { session_id: 'agentic_session_1' },
  updateError = null,
}: {
  readError?: unknown;
  readSession?: typeof session | null;
  updateData?: { session_id: string } | null;
  updateError?: unknown;
} = {}) {
  const readMaybeSingle = vi.fn().mockResolvedValue({
    data: readSession,
    error: readError,
  });
  const readChain = {
    eq: vi.fn(),
    maybeSingle: readMaybeSingle,
  };
  readChain.eq.mockReturnValue(readChain);

  const maybeSingle = vi.fn().mockResolvedValue({
    data: updateData,
    error: updateError,
  });
  const updateChain = {
    eq: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    select: vi.fn(() => ({ maybeSingle })),
  };
  updateChain.eq.mockReturnValue(updateChain);
  updateChain.in.mockReturnValue(updateChain);
  updateChain.is.mockReturnValue(updateChain);

  const select = vi.fn(() => readChain);
  const update = vi.fn(() => updateChain);
  const from = vi.fn(() => ({ select, update }));

  return {
    from,
    maybeSingle,
    readChain,
    select,
    supabase: { from } as unknown as SupabaseClient,
    update,
    updateChain,
  };
}

function createRequest(body: unknown) {
  return new NextRequest(
    'http://localhost/api/agentic/checkout_sessions/agentic_session_1',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-1',
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }
  );
}

function routeParams() {
  return { params: Promise.resolve({ id: 'agentic_session_1' }) };
}

describe('POST /api/agentic/checkout_sessions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveAgenticMerchantContext.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockVerifyAgenticApiKey.mockReturnValue(true);
    vi.mocked(calculateCheckoutSession).mockResolvedValue(sessionCalc);
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
    const { POST } = await import('./route');
    const response = await POST(createRequest('{invalid-json'), routeParams());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 401 when API key verification fails and skips DB calls', async () => {
    mockVerifyAgenticApiKey.mockReturnValue(false);

    const { POST } = await import('./route');
    const response = await POST(createRequest({ items: [] }), routeParams());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(calculateCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 400 when the session id route param is invalid', async () => {
    const { POST } = await import('./route');
    const response = await POST(createRequest({ items: [] }), {
      params: Promise.resolve({ id: '../bad' }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: 'Invalid route params' });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(calculateCheckoutSession).not.toHaveBeenCalled();
  });

  it('updates an existing checkout session with merchant-scoped guards', async () => {
    const mock = createCheckoutSupabaseMock();
    vi.mocked(createServiceClient).mockReturnValue(mock.supabase);
    vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue(mock.supabase);

    const { POST } = await import('./route');
    const response = await POST(
      createRequest({
        shipping_address: { address: '12 Example Street', city: 'Lagos' },
        fulfillment_option_id: 'shipping_standard',
      }),
      routeParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: 'agentic_session_1',
      status: 'ready_for_payment',
      fulfillment_option_id: 'shipping_standard',
      shipping_address: { address: '12 Example Street', city: 'Lagos' },
    });
    expect(mock.readChain.eq).toHaveBeenCalledWith(
      'session_id',
      'agentic_session_1'
    );
    expect(mock.readChain.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        cart_items: [{ id: 'product-1', quantity: 1 }],
        shipping_method: 'shipping_standard',
        status: 'processing',
      })
    );
    expect(mock.updateChain.eq).toHaveBeenCalledWith(
      'session_id',
      'agentic_session_1'
    );
    expect(mock.updateChain.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(mock.updateChain.is).toHaveBeenCalledWith('order_id', null);
    expect(mock.updateChain.is).toHaveBeenCalledWith('payment_reference', null);
    expect(mock.updateChain.is).toHaveBeenCalledWith(
      'virtual_account_number',
      null
    );
  });

  it('returns 500 when the guarded checkout session update fails', async () => {
    const mock = createCheckoutSupabaseMock({
      updateData: null,
      updateError: { message: 'write failed' },
    });
    vi.mocked(createServiceClient).mockReturnValue(mock.supabase);
    vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue(mock.supabase);

    const { POST } = await import('./route');
    const response = await POST(
      createRequest({ shipping_address: { city: 'Lagos' } }),
      routeParams()
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Database error' });
  });
});
