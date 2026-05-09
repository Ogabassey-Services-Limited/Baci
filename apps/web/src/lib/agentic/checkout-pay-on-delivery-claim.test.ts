import { describe, expect, it, vi } from 'vitest';
import {
  claimPayOnDeliveryFinalization,
  getMarkedPayOnDeliveryFinalizationOrderId,
  recordPayOnDeliveryOrderCreated,
  releasePayOnDeliveryFinalizationClaim,
} from '@/lib/agentic/checkout-pay-on-delivery-claim';

const buyer = {
  email: 'buyer@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone_number: '+2348012345678',
};

function createCheckoutSessionUpdateMock(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const chain = {
    contains: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle,
    not: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  };
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  chain.contains.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);

  return {
    chain,
    supabase: {
      from: vi.fn().mockReturnValue(chain),
    },
  };
}

describe('pay-on-delivery finalization claim helpers', () => {
  it('claims a checkout session for pay-on-delivery finalization', async () => {
    const mock = createCheckoutSessionUpdateMock({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });

    const result = await claimPayOnDeliveryFinalization({
      buyer,
      finalizationClaim: 'claim-1',
      merchantId: 'merchant-1',
      metadata: { agentic: { existing: true } },
      sessionId: 'agentic_session_1',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({ claimed: true, error: null });
    expect(mock.supabase.from).toHaveBeenCalledWith('checkout_sessions');
    expect(mock.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          agentic: expect.objectContaining({
            buyer,
            existing: true,
            finalization_claim: 'claim-1',
            payment_method: 'pay_on_delivery',
            payment_state: 'order_finalizing',
          }),
        }),
        payment_reference: 'claim-1',
      })
    );
  });

  it('records the order id after order creation so retries can resume', async () => {
    const mock = createCheckoutSessionUpdateMock({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });

    const result = await recordPayOnDeliveryOrderCreated({
      finalizationClaim: 'claim-1',
      merchantId: 'merchant-1',
      metadata: { agentic: { existing: true } },
      orderId: 'order-1',
      sessionId: 'agentic_session_1',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({ error: null, recorded: true });
    expect(mock.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          agentic: expect.objectContaining({
            existing: true,
            finalization_claim: 'claim-1',
            finalization_order_id: 'order-1',
            payment_method: 'pay_on_delivery',
            payment_state: 'order_finalizing',
          }),
        }),
      })
    );
  });

  it('returns release status when the finalization claim is cleared', async () => {
    const mock = createCheckoutSessionUpdateMock({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });

    const result = await releasePayOnDeliveryFinalizationClaim({
      finalizationClaim: 'claim-1',
      merchantId: 'merchant-1',
      metadata: {
        agentic: {
          finalization_claim: 'claim-1',
          payment_method: 'pay_on_delivery',
          payment_state: 'order_finalizing',
        },
      },
      orderError: 'order failed',
      sessionId: 'agentic_session_1',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({ error: null, released: true });
    expect(mock.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          agentic: expect.not.objectContaining({
            finalization_claim: expect.anything(),
            payment_state: expect.anything(),
          }),
        }),
        payment_reference: null,
      })
    );
  });

  it('reads a trimmed marked finalization order id from metadata', () => {
    expect(
      getMarkedPayOnDeliveryFinalizationOrderId({
        agentic: { finalization_order_id: '  order-1  ' },
      })
    ).toBe('order-1');
    expect(
      getMarkedPayOnDeliveryFinalizationOrderId({
        agentic: { finalization_order_id: '   ' },
      })
    ).toBeNull();
  });
});
