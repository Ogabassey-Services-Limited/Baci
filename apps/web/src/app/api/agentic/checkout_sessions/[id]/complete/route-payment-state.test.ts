import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as createOrder } from '@/app/api/orders/route';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import {
  reserveAgenticIdempotencyKey,
  storeAgenticIdempotencyResponse,
} from '@/lib/agentic/idempotency';
import { createDedicatedVirtualAccount } from '@/lib/agentic/paystack';
import { reserveAgenticRequestId } from '@/lib/agentic/request-replay';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { createServiceClient } from '@/lib/supabase/service';

const mockVerifyAgenticApiKey = vi.fn(() => true);
const mockResolveAgenticMerchantContext = vi.fn(() =>
  Promise.resolve({
    id: 'merchant-1',
    paystack_subaccount_code: 'ACCT_test123',
    slug: 'ogabassey',
  })
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
vi.mock('@/lib/agentic/paystack', () => ({
  createDedicatedVirtualAccount: vi.fn(),
  isValidPaystackSubaccountCode: vi.fn(() => true),
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
vi.mock('@/app/api/orders/route', () => ({ POST: vi.fn() }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));

const confirmationSecret = 'test-confirmation-secret';
const readySession = {
  id: 'row-1',
  session_id: 'agentic_session_1',
  merchant_id: 'merchant-1',
  cart_items: [{ id: 'product-1', quantity: 1 }],
  shipping_method: 'pickup_store_1',
  shipping_address: { city: 'Lagos' },
  currency: 'NGN',
  status: 'processing',
  order_id: null,
  payment_reference: null,
  virtual_account_bank: null,
  virtual_account_name: null,
  virtual_account_number: null,
  metadata: { agentic: { existing: true } },
};

function buildCompleteRequest({
  includeAuthorization = true,
}: {
  includeAuthorization?: boolean;
} = {}) {
  const body: Record<string, unknown> = {
    payment_data: { provider: 'paystack', token: 'confirmed-by-human' },
    buyer: {
      email: 'buyer@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone_number: '+2348012345678',
    },
  };

  if (includeAuthorization) {
    body.completion_authorization = validHumanConfirmation();
  }

  return new NextRequest(
    'http://localhost/api/agentic/checkout_sessions/agentic_session_1/complete',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-1',
      },
      body: JSON.stringify(body),
    }
  );
}

function validHumanConfirmation() {
  const confirmedAt = new Date().toISOString();
  const payload = JSON.stringify({
    amount: 500000,
    confirmed_at: confirmedAt,
    currency: 'NGN',
    session_id: 'agentic_session_1',
    type: 'human_confirmation',
  });

  return {
    amount: 500000,
    confirmed_at: confirmedAt,
    currency: 'NGN',
    session_id: 'agentic_session_1',
    signature: createHmac('sha256', confirmationSecret)
      .update(payload)
      .digest('hex'),
    type: 'human_confirmation',
  };
}

function mockSession(session: Record<string, unknown>) {
  const updateSpy = vi.fn();
  const readChain = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: session, error: null }),
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

  return { updateSpy };
}

function mockCalculatedSession() {
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
    fulfillmentOptions: [],
    selectedOptionId: 'pickup_store_1',
    messages: [],
  });
}

describe('POST /api/agentic/checkout_sessions/[id]/complete payment state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', confirmationSecret);
    mockVerifyAgenticApiKey.mockReturnValue(true);
    mockResolveAgenticMerchantContext.mockResolvedValue({
      id: 'merchant-1',
      paystack_subaccount_code: 'ACCT_test123',
      slug: 'ogabassey',
    });
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

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('requires completion authorization before payment side effects', async () => {
    const { updateSpy } = mockSession(readySession);
    mockCalculatedSession();

    const params = { params: Promise.resolve({ id: 'agentic_session_1' }) };
    const { POST } = await import('./route');
    const response = await POST(
      buildCompleteRequest({ includeAuthorization: false }),
      params
    );
    const body = await response.json();

    expect(response.status).toBe(428);
    expect(body).toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      error: 'Human confirmation required',
      retryable: true,
    });
    expect(updateSpy).not.toHaveBeenCalled();
    expect(createDedicatedVirtualAccount).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('returns existing payment details without creating duplicate DVA or order', async () => {
    const { updateSpy } = mockSession({
      ...readySession,
      status: 'processing',
      order_id: 'order-1',
      payment_reference: '1234567890',
      virtual_account_bank: 'Paystack-Titan',
      virtual_account_name: 'Baci Test',
      virtual_account_number: '1234567890',
      metadata: {
        agentic: {
          buyer: {
            email: 'buyer@example.com',
            first_name: 'Ada',
            last_name: 'Lovelace',
            phone_number: '+2348012345678',
          },
          payment_state: 'payment_pending',
        },
      },
    });
    mockCalculatedSession();

    const params = { params: Promise.resolve({ id: 'agentic_session_1' }) };
    const { POST } = await import('./route');
    const response = await POST(buildCompleteRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createDedicatedVirtualAccount).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      id: 'agentic_session_1',
      status: 'ready_for_payment',
      order_id: 'order-1',
      payment_details: {
        account_number: '1234567890',
        bank_name: 'Paystack-Titan',
      },
    });
  });

  it('rejects completion before the session is ready for payment side effects', async () => {
    const { updateSpy } = mockSession({
      ...readySession,
      shipping_address: null,
      status: 'pending',
    });
    mockCalculatedSession();

    const params = { params: Promise.resolve({ id: 'agentic_session_1' }) };
    const { POST } = await import('./route');
    const response = await POST(buildCompleteRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: 'Session is not ready for payment',
      status: 'not_ready_for_payment',
    });
    expect(updateSpy).not.toHaveBeenCalled();
    expect(createDedicatedVirtualAccount).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });
});
