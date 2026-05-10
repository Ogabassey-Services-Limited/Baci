import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeAgenticPayOnDeliveryCheckout } from '@/lib/agentic/checkout-pay-on-delivery-finalize';

const mocks = vi.hoisted(() => ({
  buildOrderFinalizationClaim: vi.fn(() => 'claim-1'),
  buildPayOnDeliveryCheckoutResponse: vi.fn(() => ({ ok: true })),
  buildPayOnDeliveryCompletedSessionUpdate: vi.fn(() => ({
    metadata: {},
    order_id: 'order-1',
  })),
  buildPayOnDeliveryOrderPayload: vi.fn(() => ({ payload: true })),
  buildPersistedAgenticIdempotencyResponse: vi.fn(
    ({ response, status }: { response: unknown; status: number }) => ({
      body: response,
      status,
    })
  ),
  buildStoredAgenticIdempotencyResponse: vi.fn(
    ({ response, status }: { response: unknown; status: number }) => ({
      body: response,
      status,
    })
  ),
  claimPayOnDeliveryFinalization: vi.fn(),
  compensatePayOnDeliveryFinalizationFailure: vi.fn(),
  createAgenticCheckoutOrder: vi.fn(),
  getMarkedPayOnDeliveryFinalizationOrderId: vi.fn(),
  handlePayOnDeliverySessionCompletionFailure: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  persistAgenticIdempotencyResponse: vi.fn(),
  recordPayOnDeliveryOrderCreated: vi.fn(),
  releasePayOnDeliveryClaimSafely: vi.fn(),
  sendAgenticOrderCreatedWebhook: vi.fn(),
}));

vi.mock('@/lib/agentic/checkout-order-dispatch', () => ({
  createAgenticCheckoutOrder: mocks.createAgenticCheckoutOrder,
  sendAgenticOrderCreatedWebhook: mocks.sendAgenticOrderCreatedWebhook,
}));

vi.mock('@/lib/agentic/checkout-order-finalization-claim', () => ({
  buildOrderFinalizationClaim: mocks.buildOrderFinalizationClaim,
}));

vi.mock('@/lib/agentic/checkout-pay-on-delivery-claim', () => ({
  claimPayOnDeliveryFinalization: mocks.claimPayOnDeliveryFinalization,
  getMarkedPayOnDeliveryFinalizationOrderId:
    mocks.getMarkedPayOnDeliveryFinalizationOrderId,
  recordPayOnDeliveryOrderCreated: mocks.recordPayOnDeliveryOrderCreated,
}));

vi.mock('@/lib/agentic/checkout-pay-on-delivery-compensation', () => ({
  compensatePayOnDeliveryFinalizationFailure:
    mocks.compensatePayOnDeliveryFinalizationFailure,
  releasePayOnDeliveryClaimSafely: mocks.releasePayOnDeliveryClaimSafely,
}));

vi.mock('@/lib/agentic/checkout-pay-on-delivery-payloads', () => ({
  buildPayOnDeliveryCheckoutResponse: mocks.buildPayOnDeliveryCheckoutResponse,
  buildPayOnDeliveryCompletedSessionUpdate:
    mocks.buildPayOnDeliveryCompletedSessionUpdate,
  buildPayOnDeliveryOrderPayload: mocks.buildPayOnDeliveryOrderPayload,
  PAY_ON_DELIVERY_METHOD: 'pay_on_delivery',
}));

vi.mock(
  '@/lib/agentic/checkout-pay-on-delivery-session-completion-failure',
  () => ({
    handlePayOnDeliverySessionCompletionFailure:
      mocks.handlePayOnDeliverySessionCompletionFailure,
  })
);

vi.mock('@/lib/agentic/idempotency-response-storage', () => ({
  buildPersistedAgenticIdempotencyResponse:
    mocks.buildPersistedAgenticIdempotencyResponse,
  buildStoredAgenticIdempotencyResponse:
    mocks.buildStoredAgenticIdempotencyResponse,
  persistAgenticIdempotencyResponse: mocks.persistAgenticIdempotencyResponse,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError, warn: mocks.loggerWarn },
}));

const buyer = {
  email: 'buyer@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone_number: '+2348012345678',
};

const metadata = { agentic: { existing: true } };
const orderSession = {
  currency: 'NGN',
  merchant_id: 'merchant-1',
  session_id: 'agentic_session_1',
  shipping_address: { city: 'Lagos' },
};
const orderSessionCalc = {
  lineItems: [],
  totals: [{ type: 'total', amount: 500000 }],
} as unknown as Parameters<
  typeof finalizeAgenticPayOnDeliveryCheckout
>[0]['orderSessionCalc'];

function buildSessionUpdateMock(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const chain = {
    contains: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle,
    select: vi.fn(),
    update: vi.fn(),
  };
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  chain.contains.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  return { chain, supabase: { from: vi.fn().mockReturnValue(chain) } };
}

function callFinalize(supabase: unknown) {
  return finalizeAgenticPayOnDeliveryCheckout({
    buyer,
    idempotencyKey: 'idem-1',
    merchantId: 'merchant-1',
    metadata,
    orderSession,
    orderSessionCalc,
    requestId: 'req-1',
    route: '/api/agentic/checkout_sessions/x/complete',
    sessionId: 'agentic_session_1',
    supabase: supabase as never,
  });
}

describe('finalizeAgenticPayOnDeliveryCheckout retry behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMarkedPayOnDeliveryFinalizationOrderId.mockReturnValue(null);
    mocks.claimPayOnDeliveryFinalization.mockResolvedValue({
      claimed: true,
      error: null,
    });
    mocks.recordPayOnDeliveryOrderCreated.mockResolvedValue({
      error: null,
      recorded: true,
    });
    mocks.createAgenticCheckoutOrder.mockResolvedValue({
      ok: true,
      orderId: 'order-1',
    });
    mocks.persistAgenticIdempotencyResponse.mockResolvedValue({ ok: true });
    mocks.handlePayOnDeliverySessionCompletionFailure.mockResolvedValue({
      body: { error: 'Database error' },
      status: 500,
    });
  });

  it('delegates session-update failures to the post-success failure handler', async () => {
    const updateError = { message: 'update failed' };
    const mock = buildSessionUpdateMock({ data: null, error: updateError });

    const result = await callFinalize(mock.supabase);

    expect(result).toEqual({ body: { error: 'Database error' }, status: 500 });
    expect(
      mocks.handlePayOnDeliverySessionCompletionFailure
    ).toHaveBeenCalledWith(expect.objectContaining({ updateError }));
    expect(mocks.sendAgenticOrderCreatedWebhook).not.toHaveBeenCalled();
  });

  it('skips order creation when metadata already has a marked finalization order id', async () => {
    mocks.getMarkedPayOnDeliveryFinalizationOrderId.mockReturnValue('order-1');
    const mock = buildSessionUpdateMock({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });

    const result = await callFinalize(mock.supabase);

    expect(result).toMatchObject({ status: 200 });
    expect(mocks.createAgenticCheckoutOrder).not.toHaveBeenCalled();
    expect(mocks.recordPayOnDeliveryOrderCreated).not.toHaveBeenCalled();
    expect(mocks.sendAgenticOrderCreatedWebhook).toHaveBeenCalledTimes(1);
  });

  it('uses live claim metadata when a recovered claim already has an order marker', async () => {
    const liveMetadata = {
      agentic: {
        existing: true,
        finalization_claim: 'claim-1',
        finalization_order_id: 'order-live',
        payment_method: 'pay_on_delivery',
        payment_state: 'order_finalizing',
      },
    };
    mocks.claimPayOnDeliveryFinalization.mockResolvedValue({
      claimed: true,
      error: null,
      metadata: liveMetadata,
    });
    mocks.getMarkedPayOnDeliveryFinalizationOrderId.mockReturnValue(
      'order-live'
    );
    const mock = buildSessionUpdateMock({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });

    const result = await callFinalize(mock.supabase);

    expect(result).toMatchObject({ status: 200 });
    expect(
      mocks.getMarkedPayOnDeliveryFinalizationOrderId
    ).toHaveBeenCalledWith(liveMetadata);
    expect(mocks.createAgenticCheckoutOrder).not.toHaveBeenCalled();
    expect(mocks.recordPayOnDeliveryOrderCreated).not.toHaveBeenCalled();
    expect(mocks.buildPayOnDeliveryCompletedSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: liveMetadata })
    );
  });

  it('leaves session in order_finalizing when idempotency persistence fails', async () => {
    mocks.persistAgenticIdempotencyResponse.mockResolvedValue({
      error: { message: 'storage 503' },
      ok: false,
    });
    const mock = buildSessionUpdateMock({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });

    const result = await callFinalize(mock.supabase);

    expect(result).toEqual({
      body: { error: 'Idempotency response storage failed' },
      status: 503,
    });
    expect(mock.chain.update).not.toHaveBeenCalled();
    expect(mocks.releasePayOnDeliveryClaimSafely).not.toHaveBeenCalled();
    expect(
      mocks.compensatePayOnDeliveryFinalizationFailure
    ).not.toHaveBeenCalled();
  });
});
