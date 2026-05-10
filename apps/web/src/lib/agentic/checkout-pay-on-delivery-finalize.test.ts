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
  return {
    chain,
    supabase: { from: vi.fn().mockReturnValue(chain) },
  };
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

describe('finalizeAgenticPayOnDeliveryCheckout', () => {
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
  });

  it('returns 500 when the claim helper reports an error', async () => {
    mocks.claimPayOnDeliveryFinalization.mockResolvedValue({
      claimed: false,
      error: { message: 'db error' },
    });
    const supabase = buildSessionUpdateMock({
      data: { session_id: 'x' },
      error: null,
    }).supabase;

    const result = await callFinalize(supabase);

    expect(result).toEqual({ body: { error: 'Database error' }, status: 500 });
    expect(mocks.createAgenticCheckoutOrder).not.toHaveBeenCalled();
    expect(mocks.sendAgenticOrderCreatedWebhook).not.toHaveBeenCalled();
  });

  it('returns 409 when the claim is not granted (already in progress)', async () => {
    mocks.claimPayOnDeliveryFinalization.mockResolvedValue({
      claimed: false,
      error: null,
    });
    const supabase = buildSessionUpdateMock({
      data: { session_id: 'x' },
      error: null,
    }).supabase;

    const result = await callFinalize(supabase);

    expect(result).toEqual({
      body: {
        error: 'Session finalization already in progress',
        status: 'payment_pending',
      },
      status: 409,
    });
    expect(mocks.createAgenticCheckoutOrder).not.toHaveBeenCalled();
  });

  it('happy path: creates order, marks it, updates session, dispatches webhook', async () => {
    const mock = buildSessionUpdateMock({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });

    const result = await callFinalize(mock.supabase);

    expect(result).toMatchObject({ status: 200 });
    expect(mocks.createAgenticCheckoutOrder).toHaveBeenCalledTimes(1);
    expect(mocks.recordPayOnDeliveryOrderCreated).toHaveBeenCalledTimes(1);
    expect(mocks.sendAgenticOrderCreatedWebhook).toHaveBeenCalledTimes(1);
    expect(
      mocks.compensatePayOnDeliveryFinalizationFailure
    ).not.toHaveBeenCalled();
    expect(mocks.releasePayOnDeliveryClaimSafely).not.toHaveBeenCalled();
  });

  it('returns 500 and releases the claim when createAgenticCheckoutOrder throws', async () => {
    mocks.createAgenticCheckoutOrder.mockRejectedValue(new Error('boom'));
    const supabase = buildSessionUpdateMock({
      data: { session_id: 'x' },
      error: null,
    }).supabase;

    const result = await callFinalize(supabase);

    expect(result).toEqual({
      body: { error: 'Order creation failed' },
      status: 500,
    });
    expect(mocks.releasePayOnDeliveryClaimSafely).toHaveBeenCalledTimes(1);
    expect(mocks.sendAgenticOrderCreatedWebhook).not.toHaveBeenCalled();
  });

  it('returns 500 and releases the claim when createAgenticCheckoutOrder returns ok=false', async () => {
    mocks.createAgenticCheckoutOrder.mockResolvedValue({
      ok: false,
      error: 'rejected',
      statusText: 'Bad Request',
    });
    const supabase = buildSessionUpdateMock({
      data: { session_id: 'x' },
      error: null,
    }).supabase;

    const result = await callFinalize(supabase);

    expect(result).toEqual({
      body: { error: 'Order creation failed' },
      status: 500,
    });
    expect(mocks.releasePayOnDeliveryClaimSafely).toHaveBeenCalledTimes(1);
    expect(mocks.sendAgenticOrderCreatedWebhook).not.toHaveBeenCalled();
  });

  it('returns 500 and releases the claim when createAgenticCheckoutOrder is missing orderId', async () => {
    mocks.createAgenticCheckoutOrder.mockResolvedValue({
      ok: true,
      orderId: undefined,
    });
    const supabase = buildSessionUpdateMock({
      data: { session_id: 'x' },
      error: null,
    }).supabase;

    const result = await callFinalize(supabase);

    expect(result).toEqual({
      body: { error: 'Order creation failed' },
      status: 500,
    });
    expect(mocks.releasePayOnDeliveryClaimSafely).toHaveBeenCalledTimes(1);
    expect(mocks.sendAgenticOrderCreatedWebhook).not.toHaveBeenCalled();
  });

  it('compensates and returns 500 when recordPayOnDeliveryOrderCreated reports recorded:false', async () => {
    mocks.recordPayOnDeliveryOrderCreated.mockResolvedValue({
      error: { message: 'no row' },
      recorded: false,
    });
    const supabase = buildSessionUpdateMock({
      data: { session_id: 'x' },
      error: null,
    }).supabase;

    const result = await callFinalize(supabase);

    expect(result).toEqual({ body: { error: 'Database error' }, status: 500 });
    expect(
      mocks.compensatePayOnDeliveryFinalizationFailure
    ).toHaveBeenCalledTimes(1);
    expect(
      mocks.compensatePayOnDeliveryFinalizationFailure
    ).toHaveBeenCalledWith(
      expect.objectContaining({ orderError: { message: 'no row' } })
    );
    expect(mocks.sendAgenticOrderCreatedWebhook).not.toHaveBeenCalled();
  });

  it('compensates and returns 500 when the session-update query reports no row updated', async () => {
    const updateError = { message: 'update failed' };
    const mock = buildSessionUpdateMock({ data: null, error: updateError });

    const result = await callFinalize(mock.supabase);

    expect(result).toEqual({ body: { error: 'Database error' }, status: 500 });
    expect(
      mocks.compensatePayOnDeliveryFinalizationFailure
    ).toHaveBeenCalledTimes(1);
    expect(
      mocks.compensatePayOnDeliveryFinalizationFailure
    ).toHaveBeenCalledWith(
      expect.objectContaining({ orderError: updateError })
    );
    expect(mocks.sendAgenticOrderCreatedWebhook).not.toHaveBeenCalled();
  });

  it('skips order creation when metadata already has a marked finalization order id (resume)', async () => {
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
    expect(mocks.sendAgenticOrderCreatedWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-live' })
    );
  });

  it('leaves session in order_finalizing when idempotency persistence fails so retry can resume', async () => {
    // Arrange: order creation + claim + marker all succeed; persistence fails.
    mocks.persistAgenticIdempotencyResponse.mockResolvedValue({
      error: { message: 'storage 503' },
      ok: false,
    });
    const mock = buildSessionUpdateMock({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });

    // Act
    const result = await callFinalize(mock.supabase);

    // Assert: status flip to 'completed' must NOT have been attempted, the
    // claim must NOT have been released or the order canceled, and the
    // success webhook must NOT have fired. Returned status conveys the
    // transient storage failure so the client can retry; the retry will
    // resume via the marked finalization_order_id.
    expect(result).toEqual({
      body: { error: 'Idempotency response storage failed' },
      status: 503,
    });
    expect(mock.chain.update).not.toHaveBeenCalled();
    expect(mock.supabase.from).not.toHaveBeenCalledWith('checkout_sessions');
    expect(mocks.releasePayOnDeliveryClaimSafely).not.toHaveBeenCalled();
    expect(
      mocks.compensatePayOnDeliveryFinalizationFailure
    ).not.toHaveBeenCalled();
    expect(mocks.sendAgenticOrderCreatedWebhook).not.toHaveBeenCalled();
    // The order WAS created, so this assertion is informational: the
    // persisted finalization_order_id is what makes resume safe.
    expect(mocks.createAgenticCheckoutOrder).toHaveBeenCalledTimes(1);
    expect(mocks.recordPayOnDeliveryOrderCreated).toHaveBeenCalledTimes(1);
  });

  it('persists idempotency response BEFORE flipping checkout_sessions.status to completed', async () => {
    // Arrange
    const callOrder: string[] = [];
    mocks.persistAgenticIdempotencyResponse.mockImplementation(() => {
      callOrder.push('persist');
      return Promise.resolve({ ok: true });
    });
    const mock = buildSessionUpdateMock({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });
    mock.chain.update.mockImplementation(() => {
      callOrder.push('session-update');
      return mock.chain;
    });

    // Act
    await callFinalize(mock.supabase);

    // Assert: persistence must come strictly before the status flip update.
    const persistIndex = callOrder.indexOf('persist');
    const updateIndex = callOrder.indexOf('session-update');
    expect(persistIndex).toBeGreaterThanOrEqual(0);
    expect(updateIndex).toBeGreaterThanOrEqual(0);
    expect(persistIndex).toBeLessThan(updateIndex);
  });

  it('does not re-persist the idempotency response after a successful status flip', async () => {
    // Arrange: happy path.
    const mock = buildSessionUpdateMock({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });

    // Act
    const result = await callFinalize(mock.supabase);

    // Assert: success uses the in-memory shell builder, not the
    // store-and-build helper. Persistence is called exactly once
    // (the pre-flip durable write).
    expect(result).toMatchObject({ status: 200 });
    expect(mocks.persistAgenticIdempotencyResponse).toHaveBeenCalledTimes(1);
    expect(
      mocks.buildPersistedAgenticIdempotencyResponse
    ).toHaveBeenCalledTimes(1);
    // Error-path helper must not run on the success path.
    expect(
      mocks.buildStoredAgenticIdempotencyResponse
    ).not.toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
  });
});
