import { describe, expect, it, vi } from 'vitest';
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

function createUpdateChain(data: Record<string, unknown> | null) {
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
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
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
  it('does not create an order when the finalization claim is already taken', async () => {
    vi.clearAllMocks();
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
  });

  it('does not expose internal order creation errors to agents', async () => {
    vi.clearAllMocks();
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

  it('guards final order persistence with an order_id null claim', async () => {
    vi.clearAllMocks();
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
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: null,
      ok: true,
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
