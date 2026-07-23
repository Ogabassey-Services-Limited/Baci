// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveGrandfatheredPaymentPendingReplay } from './agentic-paystack-dva-grandfathered-response';
import { buildAgenticPaystackDvaIdempotencyReplayResponse } from './agentic-paystack-dva-idempotency-replay-response';
import { getAgenticCheckoutSession } from './checkout-session-record';

vi.mock('server-only', () => ({}));
vi.mock('./agentic-paystack-dva-grandfathered-response', () => ({
  resolveGrandfatheredPaymentPendingReplay: vi.fn(),
}));
vi.mock('./checkout-session-record', () => ({
  getAgenticCheckoutSession: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

const replay = {
  ok: true as const,
  requestHash: 'a'.repeat(64),
  response: { id: 'agentic_session_1', status: 'ready_for_payment' },
  state: 'replay' as const,
  status: 200,
};
const baseInput = {
  idempotencyKey: 'idem-1',
  merchantId: 'merchant-1',
  paymentProvider: 'paystack',
  replay,
  requestId: 'req_123',
  sessionId: 'agentic_session_1',
  supabase: {} as never,
};

describe('buildAgenticPaystackDvaIdempotencyReplayResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'paused');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the exact replay after the paused session proof matches', async () => {
    const session = { currency: 'NGN', session_id: 'agentic_session_1' };
    vi.mocked(getAgenticCheckoutSession).mockResolvedValue({
      data: session as never,
      error: null,
    });
    vi.mocked(resolveGrandfatheredPaymentPendingReplay).mockReturnValue({
      body: replay.response,
      status: 200,
    });

    const response =
      await buildAgenticPaystackDvaIdempotencyReplayResponse(baseInput);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(replay.response);
    expect(response.headers.get('idempotency-key')).toBe('idem-1');
    expect(getAgenticCheckoutSession).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      sessionId: 'agentic_session_1',
      supabase: baseInput.supabase,
    });
  });

  it('rejects drift without returning the stored bank response', async () => {
    vi.mocked(getAgenticCheckoutSession).mockResolvedValue({
      data: { currency: 'NGN', session_id: 'agentic_session_1' } as never,
      error: null,
    });
    vi.mocked(resolveGrandfatheredPaymentPendingReplay).mockReturnValue(null);

    const response =
      await buildAgenticPaystackDvaIdempotencyReplayResponse(baseInput);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'AGENTIC_PAYSTACK_DVA_PAUSED',
      error: 'Agentic Paystack bank transfer is paused',
    });
  });

  it('fails closed on a checkout-session lookup error', async () => {
    vi.mocked(getAgenticCheckoutSession).mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'denied' } as never,
    });

    const response =
      await buildAgenticPaystackDvaIdempotencyReplayResponse(baseInput);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Database error' });
    expect(resolveGrandfatheredPaymentPendingReplay).not.toHaveBeenCalled();
  });

  it('keeps enabled and non-DVA replay behavior unchanged', async () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'enabled');
    const enabled =
      await buildAgenticPaystackDvaIdempotencyReplayResponse(baseInput);
    const pod = await buildAgenticPaystackDvaIdempotencyReplayResponse({
      ...baseInput,
      paymentProvider: 'pay_on_delivery',
    });

    expect(enabled.status).toBe(200);
    expect(pod.status).toBe(200);
    expect(getAgenticCheckoutSession).not.toHaveBeenCalled();
  });
});
