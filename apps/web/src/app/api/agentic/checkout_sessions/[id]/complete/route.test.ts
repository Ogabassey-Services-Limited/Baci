import { NextRequest, NextResponse } from 'next/server';
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
import {
  completionConfirmationSecret,
  validHumanConfirmation,
} from './route-complete-test-helpers';

const mockVerifyAgenticApiKey = vi.fn(() => true);
const mockResolveAgenticMerchantContext = vi.fn(() =>
  Promise.resolve({
    id: 'merchant-1',
    paystack_subaccount_code: 'ACCT_test123',
    slug: 'ogabassey',
  })
);
const mockSendAgenticWebhook = vi.fn(() => Promise.resolve());
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
vi.mock('@/lib/agentic/webhooks', () => ({
  sendAgenticWebhook: mockSendAgenticWebhook,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/app/api/orders/route', () => ({ POST: vi.fn() }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));
const storedSession = {
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
function createClaimUpdateChain() {
  const chain = {} as Record<
    'eq' | 'is' | 'not' | 'select',
    ReturnType<typeof vi.fn>
  >;
  const maybeSingle = vi.fn().mockResolvedValue({
    data: storedSession,
    error: null,
  });
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.select = vi.fn(() => ({ maybeSingle }));
  return chain;
}
function createFinalUpdateChain() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { session_id: 'agentic_session_1' },
    error: null,
  });
  const chain = {} as Record<
    'contains' | 'eq' | 'in' | 'is' | 'select',
    ReturnType<typeof vi.fn>
  >;
  chain.contains = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.select = vi.fn(() => ({ maybeSingle }));
  return chain;
}
function createSessionReadChain() {
  const chain = {} as Record<'eq' | 'maybeSingle', ReturnType<typeof vi.fn>>;
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({
    data: storedSession,
    error: null,
  });
  return chain;
}
function getPaymentState(payload: unknown) {
  const metadata =
    payload && typeof payload === 'object' && 'metadata' in payload
      ? (payload as { metadata?: { agentic?: { payment_state?: unknown } } })
          .metadata
      : undefined;
  return metadata?.agentic?.payment_state;
}
describe('POST /api/agentic/checkout_sessions/[id]/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', completionConfirmationSecret);
    mockVerifyAgenticApiKey.mockReturnValue(true);
    mockResolveAgenticMerchantContext.mockResolvedValue({
      id: 'merchant-1',
      paystack_subaccount_code: 'ACCT_test123',
      slug: 'ogabassey',
    });
    mockSendAgenticWebhook.mockResolvedValue(undefined);
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
  it('stores DVA payment state without writing agent-only checkout statuses', async () => {
    const updateSpy = vi.fn((payload: Record<string, unknown>) =>
      getPaymentState(payload) === 'claiming_payment'
        ? createClaimUpdateChain()
        : createFinalUpdateChain()
    );
    const readChain = createSessionReadChain();

    const mockSupabase = {
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
      totals: [
        {
          type: 'items_base_amount',
          display_text: 'Items Subtotal',
          amount: 500000,
        },
        { type: 'total', display_text: 'Total Due', amount: 500000 },
      ],
      fulfillmentOptions: [],
      selectedOptionId: 'pickup_store_1',
      messages: [],
    });
    vi.mocked(createDedicatedVirtualAccount).mockResolvedValue({
      account_name: 'Baci Test',
      account_number: '1234567890',
      assigned: true,
      bank_name: 'Paystack-Titan',
      currency: 'NGN',
    });
    vi.mocked(createOrder).mockResolvedValue(
      NextResponse.json(
        { order: { id: 'order-1' }, wallet: null, amountDueToGateway: 0 },
        { status: 201 }
      )
    );
    const request = new NextRequest(
      'http://localhost/api/agentic/checkout_sessions/agentic_session_1/complete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
        },
        body: JSON.stringify({
          completion_authorization: validHumanConfirmation(),
          payment_data: { provider: 'paystack', token: 'confirmed-by-human' },
          buyer: {
            email: 'buyer@example.com',
            first_name: 'Ada',
            last_name: 'Lovelace',
            phone_number: '+2348012345678',
          },
        }),
      }
    );
    const params = { params: Promise.resolve({ id: 'agentic_session_1' }) };
    const { POST } = await import('./route');
    const response = await POST(request, params);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(readChain.eq).toHaveBeenCalledWith(
      'session_id',
      'agentic_session_1'
    );
    expect(createDedicatedVirtualAccount).toHaveBeenCalledWith(
      expect.any(Object),
      { subaccount: 'ACCT_test123' }
    );
    expect(readChain.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'processing',
        order_id: 'order-1',
        payment_method: 'bank_transfer',
        payment_provider: 'paystack',
        virtual_account_number: '1234567890',
      })
    );
    expect(getPaymentState(updateSpy.mock.calls[0]?.[0])).toBe(
      'claiming_payment'
    );
    const orderRequest = vi.mocked(createOrder).mock.calls[0]?.[0];
    const orderPayload = await orderRequest?.json();
    expect(orderPayload.items[0]).toMatchObject({
      name: 'Phone',
      product_id: 'product-1',
      quantity: 1,
    });
    const updatePayload = updateSpy.mock.calls.find(
      ([payload]) => getPaymentState(payload) === 'payment_pending'
    )?.[0];
    expect(updatePayload).not.toHaveProperty('buyer');
    expect(updatePayload?.metadata).toMatchObject({
      agentic: {
        existing: true,
        payment_state: 'payment_pending',
      },
    });
    expect(body).toMatchObject({
      id: 'agentic_session_1',
      status: 'ready_for_payment',
      order: {
        id: 'order-1',
        status: 'payment_pending',
      },
      order_id: 'order-1',
    });
  });
});
