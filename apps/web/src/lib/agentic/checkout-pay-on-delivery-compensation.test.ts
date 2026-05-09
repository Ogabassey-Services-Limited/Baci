import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compensatePayOnDeliveryFinalizationFailure,
  releasePayOnDeliveryClaimSafely,
} from '@/lib/agentic/checkout-pay-on-delivery-compensation';

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn(),
  markAgenticCheckoutOrderCanceled: vi.fn(),
  releasePayOnDeliveryFinalizationClaim: vi.fn(),
}));

vi.mock('@/lib/agentic/checkout-order-dispatch', () => ({
  markAgenticCheckoutOrderCanceled: mocks.markAgenticCheckoutOrderCanceled,
}));

vi.mock('@/lib/agentic/checkout-pay-on-delivery-claim', () => ({
  releasePayOnDeliveryFinalizationClaim:
    mocks.releasePayOnDeliveryFinalizationClaim,
}));

vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));

const input = {
  finalizationClaim: 'claim-1',
  merchantId: 'merchant-1',
  metadata: { agentic: { existing: true } },
  orderError: 'marker failed',
  orderId: 'order-1',
  sessionId: 'agentic_session_1',
  supabase: {} as never,
};

describe('pay-on-delivery finalization compensation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels the created order and releases the finalization claim', async () => {
    mocks.markAgenticCheckoutOrderCanceled.mockResolvedValue({
      error: null,
      updated: true,
    });

    await compensatePayOnDeliveryFinalizationFailure(input);

    expect(mocks.markAgenticCheckoutOrderCanceled).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      orderId: 'order-1',
      sessionId: 'agentic_session_1',
      supabase: input.supabase,
    });
    expect(mocks.releasePayOnDeliveryFinalizationClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        finalizationClaim: 'claim-1',
        merchantId: 'merchant-1',
        orderError: 'marker failed',
      })
    );
  });

  it('does not release the claim when order cancellation fails', async () => {
    mocks.markAgenticCheckoutOrderCanceled.mockResolvedValue({
      error: { message: 'db failed' },
      updated: false,
    });

    await compensatePayOnDeliveryFinalizationFailure(input);

    expect(mocks.releasePayOnDeliveryFinalizationClaim).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Pay-on-delivery finalization failed after order creation',
      })
    );
  });

  it('logs and swallows release exceptions', async () => {
    mocks.releasePayOnDeliveryFinalizationClaim.mockRejectedValue(
      new Error('release failed')
    );

    await releasePayOnDeliveryClaimSafely(input);

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Pay-on-delivery finalization claim release threw',
      })
    );
  });
});
