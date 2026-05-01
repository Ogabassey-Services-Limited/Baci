import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compensateCreatedOrderAfterFinalizationFailure } from '@/lib/agentic/checkout-finalization-compensation';
import { markAgenticCheckoutOrderCanceled } from '@/lib/agentic/checkout-order-dispatch';
import { releaseAgenticOrderFinalizationClaim } from '@/lib/agentic/checkout-order-finalization-claim';

vi.mock('@/lib/agentic/checkout-order-dispatch', () => ({
  markAgenticCheckoutOrderCanceled: vi.fn(),
}));

vi.mock('@/lib/agentic/checkout-order-finalization-claim', () => ({
  releaseAgenticOrderFinalizationClaim: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

const input = {
  finalizationClaim: 'agentic_order_claim',
  merchantId: 'merchant-1',
  metadata: { agentic: { payment_state: 'order_finalizing' } },
  orderError: 'update failed',
  orderId: 'order-1',
  sessionId: 'agentic_session_1',
  supabase: {} as SupabaseClient,
};

describe('compensateCreatedOrderAfterFinalizationFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('releases the finalization claim after a successful compensation cancel', async () => {
    vi.mocked(markAgenticCheckoutOrderCanceled).mockResolvedValue({
      error: null,
      updated: true,
    });

    await compensateCreatedOrderAfterFinalizationFailure(input);

    expect(markAgenticCheckoutOrderCanceled).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        orderId: 'order-1',
        sessionId: 'agentic_session_1',
      })
    );
    expect(releaseAgenticOrderFinalizationClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        finalizationClaim: 'agentic_order_claim',
        orderError: 'update failed',
        sessionId: 'agentic_session_1',
      })
    );
  });

  it('keeps the claim when compensation cancel fails', async () => {
    vi.mocked(markAgenticCheckoutOrderCanceled).mockResolvedValue({
      error: {
        code: 'PGRST000',
        details: '',
        hint: '',
        message: 'cancel failed',
        name: 'PostgrestError',
        toJSON: () => ({
          code: 'PGRST000',
          details: '',
          hint: '',
          message: 'cancel failed',
          name: 'PostgrestError',
        }),
      },
      updated: false,
    });

    await compensateCreatedOrderAfterFinalizationFailure(input);

    expect(releaseAgenticOrderFinalizationClaim).not.toHaveBeenCalled();
  });

  it('keeps the claim when compensation cancel throws', async () => {
    vi.mocked(markAgenticCheckoutOrderCanceled).mockRejectedValue(
      new Error('network failure')
    );

    await expect(
      compensateCreatedOrderAfterFinalizationFailure(input)
    ).resolves.toBeUndefined();

    expect(releaseAgenticOrderFinalizationClaim).not.toHaveBeenCalled();
  });
});
