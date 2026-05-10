import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePayOnDeliverySessionCompletionFailure } from '@/lib/agentic/checkout-pay-on-delivery-session-completion-failure';

const mocks = vi.hoisted(() => ({
  buildPersistedAgenticIdempotencyResponse: vi.fn(
    ({ response, status }: { response: unknown; status: number }) => ({
      body: response,
      status,
    })
  ),
  compensatePayOnDeliveryFinalizationFailure: vi.fn(),
  loggerError: vi.fn(),
  persistAgenticIdempotencyResponse: vi.fn(),
}));

vi.mock('@/lib/agentic/checkout-pay-on-delivery-compensation', () => ({
  compensatePayOnDeliveryFinalizationFailure:
    mocks.compensatePayOnDeliveryFinalizationFailure,
}));

vi.mock('@/lib/agentic/idempotency-response-storage', () => ({
  buildPersistedAgenticIdempotencyResponse:
    mocks.buildPersistedAgenticIdempotencyResponse,
  persistAgenticIdempotencyResponse: mocks.persistAgenticIdempotencyResponse,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError },
}));

const input = {
  finalizationClaim: 'claim-1',
  idempotencyKey: 'idem-1',
  merchantId: 'merchant-1',
  metadata: { agentic: { existing: true } },
  orderId: 'order-1',
  requestId: 'req-1',
  route: 'checkout_sessions.complete',
  sessionId: 'agentic_session_1',
  successResponse: { ok: true },
  supabase: {} as never,
  updateError: { message: 'update failed' },
};

describe('handlePayOnDeliverySessionCompletionFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.persistAgenticIdempotencyResponse.mockResolvedValue({ ok: true });
  });

  it('stores the failure before compensating a failed session completion', async () => {
    const response = await handlePayOnDeliverySessionCompletionFailure(input);

    expect(response).toEqual({
      body: { error: 'Database error' },
      status: 500,
    });
    expect(mocks.persistAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        response: { error: 'Database error' },
        status: 500,
      })
    );
    expect(
      mocks.compensatePayOnDeliveryFinalizationFailure
    ).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order-1' }));
  });

  it('keeps the persisted success when the failure snapshot cannot be stored', async () => {
    mocks.persistAgenticIdempotencyResponse.mockResolvedValue({
      error: { message: 'store failed' },
      ok: false,
    });

    const response = await handlePayOnDeliverySessionCompletionFailure(input);

    expect(response).toEqual({ body: { ok: true }, status: 200 });
    expect(
      mocks.compensatePayOnDeliveryFinalizationFailure
    ).not.toHaveBeenCalled();
  });
});
