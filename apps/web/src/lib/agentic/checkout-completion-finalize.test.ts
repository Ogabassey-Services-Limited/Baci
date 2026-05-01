import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeAgenticCheckoutPayment } from '@/lib/agentic/checkout-completion-finalize';
import {
  createAgenticCheckoutOrder,
  markAgenticCheckoutOrderCanceled,
  sendAgenticOrderCreatedWebhook,
} from '@/lib/agentic/checkout-order-dispatch';
import { buildOrderFinalizationClaim } from '@/lib/agentic/checkout-order-finalization-claim';
import { storeAgenticIdempotencyResponse } from '@/lib/agentic/idempotency';

vi.mock('@/lib/agentic/checkout-order-dispatch', () => ({
  createAgenticCheckoutOrder: vi.fn(),
  markAgenticCheckoutOrderCanceled: vi.fn(),
  sendAgenticOrderCreatedWebhook: vi.fn(),
}));

vi.mock('@/lib/agentic/idempotency', () => ({
  storeAgenticIdempotencyResponse: vi.fn(),
}));

const buyer = {
  email: 'buyer@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone_number: '+2348012345678',
};

const dvaAccount = {
  account_name: 'Ada Lovelace',
  account_number: '1234567890',
  bank_name: 'Paystack-Titan',
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
      base_amount: 500000,
      discount: 0,
      subtotal: 500000,
      tax: 0,
      total: 500000,
    },
  ],
  totals: [{ type: 'total' as const, display_text: 'Total', amount: 500000 }],
  fulfillmentOptions: [],
  selectedOptionId: 'pickup_store_1',
  messages: [],
};

function createUpdateChain(
  data: Record<string, unknown> | null,
  error: unknown = null
) {
  const chain = {
    contains: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
  };
  chain.contains.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  chain.select.mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  });

  return chain;
}

function createSupabaseWithUpdateChains(
  chains: ReturnType<typeof createUpdateChain>[]
) {
  const update = vi.fn(() => {
    const chain = chains.shift();
    if (!chain) {
      throw new Error('Unexpected checkout_sessions update');
    }
    return chain;
  });

  return {
    from: vi.fn((table: string) => {
      if (table !== 'checkout_sessions') {
        throw new Error(`Unexpected table ${table}`);
      }
      return { update };
    }),
    update,
  };
}

function finalizeInput(supabase: unknown) {
  return {
    buyer,
    dvaAccount,
    idempotencyKey: 'idem-1',
    merchantId: 'merchant-1',
    metadata: { agentic: { payment_state: 'payment_account_ready' } },
    orderSession: {
      currency: 'NGN',
      merchant_id: 'merchant-1',
      session_id: 'agentic_session_1',
      shipping_address: { city: 'Lagos' },
    },
    orderSessionCalc: sessionCalc,
    requestId: 'req_123',
    route: 'checkout_sessions.complete',
    sessionId: 'agentic_session_1',
    supabase: supabase as never,
  };
}

describe('finalizeAgenticCheckoutPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(markAgenticCheckoutOrderCanceled).mockResolvedValue({
      error: null,
      updated: true,
    });
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: null,
      ok: true,
    });
  });

  it('does not create an order when the finalization claim is already taken', async () => {
    const claimChain = createUpdateChain(null);
    const supabase = createSupabaseWithUpdateChains([claimChain]);

    const response = await finalizeAgenticCheckoutPayment(
      finalizeInput(supabase)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: 'Session finalization already in progress',
    });
    expect(createAgenticCheckoutOrder).not.toHaveBeenCalled();
    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'idem-1',
        response: expect.objectContaining({
          error: 'Session finalization already in progress',
        }),
        route: 'checkout_sessions.complete',
        status: 409,
      })
    );
  });

  it('returns a database error when the finalization claim write fails', async () => {
    const claimChain = createUpdateChain(null, { message: 'claim failed' });
    const supabase = createSupabaseWithUpdateChains([claimChain]);

    const response = await finalizeAgenticCheckoutPayment(
      finalizeInput(supabase)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Database error' });
    expect(createAgenticCheckoutOrder).not.toHaveBeenCalled();
    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'idem-1',
        response: { error: 'Database error' },
        route: 'checkout_sessions.complete',
        status: 500,
      })
    );
    expect(sendAgenticOrderCreatedWebhook).not.toHaveBeenCalled();
  });

  it('does not expose internal order creation errors to agents', async () => {
    const claimChain = createUpdateChain({ session_id: 'agentic_session_1' });
    const releaseChain = createUpdateChain({ session_id: 'agentic_session_1' });
    const supabase = createSupabaseWithUpdateChains([claimChain, releaseChain]);
    vi.mocked(createAgenticCheckoutOrder).mockResolvedValue({
      data: {},
      error: 'database leaked payment gateway internals',
      ok: false,
      orderId: undefined,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const response = await finalizeAgenticCheckoutPayment(
      finalizeInput(supabase)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Order creation failed' });
    expect(body).not.toHaveProperty('details');
  });

  it('cancels the created order and releases the claim when session finalization fails', async () => {
    const claimChain = createUpdateChain({ session_id: 'agentic_session_1' });
    const finalChain = createUpdateChain(null, { message: 'update failed' });
    const releaseChain = createUpdateChain({ session_id: 'agentic_session_1' });
    const supabase = createSupabaseWithUpdateChains([
      claimChain,
      finalChain,
      releaseChain,
    ]);
    vi.mocked(createAgenticCheckoutOrder).mockResolvedValue({
      data: { order: { id: 'order-1' } },
      error: undefined,
      ok: true,
      orderId: 'order-1',
      status: 201,
      statusText: 'Created',
    });

    const response = await finalizeAgenticCheckoutPayment(
      finalizeInput(supabase)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Database error' });
    expect(markAgenticCheckoutOrderCanceled).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        orderId: 'order-1',
        sessionId: 'agentic_session_1',
      })
    );
    expect(releaseChain.contains).toHaveBeenCalledWith('metadata', {
      agentic: {
        finalization_claim: buildOrderFinalizationClaim({
          idempotencyKey: 'idem-1',
          requestId: 'req_123',
          sessionId: 'agentic_session_1',
        }),
        payment_state: 'order_finalizing',
      },
    });
    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'idem-1',
        response: { error: 'Database error' },
        route: 'checkout_sessions.complete',
        status: 500,
      })
    );
    expect(sendAgenticOrderCreatedWebhook).not.toHaveBeenCalled();
  });

  it('preserves the claim when order cancellation fails after session finalization failure', async () => {
    const claimChain = createUpdateChain({ session_id: 'agentic_session_1' });
    const finalChain = createUpdateChain(null, { message: 'update failed' });
    const releaseChain = createUpdateChain({ session_id: 'agentic_session_1' });
    const supabase = createSupabaseWithUpdateChains([
      claimChain,
      finalChain,
      releaseChain,
    ]);
    vi.mocked(createAgenticCheckoutOrder).mockResolvedValue({
      data: { order: { id: 'order-1' } },
      error: undefined,
      ok: true,
      orderId: 'order-1',
      status: 201,
      statusText: 'Created',
    });
    vi.mocked(markAgenticCheckoutOrderCanceled).mockResolvedValueOnce({
      error: {
        code: 'TEST_ERROR',
        details: '',
        hint: '',
        message: 'cancellation failed',
        name: 'PostgrestError',
        toJSON: () => ({
          code: 'TEST_ERROR',
          details: '',
          hint: '',
          message: 'cancellation failed',
          name: 'PostgrestError',
        }),
      },
      updated: false,
    });

    const response = await finalizeAgenticCheckoutPayment(
      finalizeInput(supabase)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Database error' });
    expect(markAgenticCheckoutOrderCanceled).toHaveBeenCalled();
    expect(releaseChain.contains).not.toHaveBeenCalled();
    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'idem-1',
        response: { error: 'Database error' },
        route: 'checkout_sessions.complete',
        status: 500,
      })
    );
    expect(sendAgenticOrderCreatedWebhook).not.toHaveBeenCalled();
  });

  it('guards final order persistence with an order_id null claim', async () => {
    const claimChain = createUpdateChain({ session_id: 'agentic_session_1' });
    const finalChain = createUpdateChain({ session_id: 'agentic_session_1' });
    const supabase = createSupabaseWithUpdateChains([claimChain, finalChain]);
    vi.mocked(createAgenticCheckoutOrder).mockResolvedValue({
      data: { order: { id: 'order-1' } },
      error: undefined,
      ok: true,
      orderId: 'order-1',
      status: 201,
      statusText: 'Created',
    });
    const response = await finalizeAgenticCheckoutPayment(
      finalizeInput(supabase)
    );

    expect(response.status).toBe(200);
    expect(finalChain.is).toHaveBeenCalledWith('order_id', null);
    const expectedFinalizationClaim = buildOrderFinalizationClaim({
      idempotencyKey: 'idem-1',
      requestId: 'req_123',
      sessionId: 'agentic_session_1',
    });
    expect(finalChain.contains).toHaveBeenCalledWith('metadata', {
      agentic: {
        finalization_claim: expectedFinalizationClaim,
        payment_state: 'order_finalizing',
      },
    });
    expect(markAgenticCheckoutOrderCanceled).not.toHaveBeenCalled();
    expect(sendAgenticOrderCreatedWebhook).toHaveBeenCalled();
  });
});
