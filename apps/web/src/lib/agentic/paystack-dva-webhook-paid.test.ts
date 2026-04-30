import { describe, expect, it, vi } from 'vitest';
import { markAgenticPaystackDvaSessionPaid } from '@/lib/agentic/paystack-dva-webhook';

describe('markAgenticPaystackDvaSessionPaid', () => {
  it('marks the agentic checkout session paid after the standard webhook path settles', async () => {
    const readChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          metadata: {
            agentic: {
              dva_account: { account_number: '9930000902' },
              payment_state: 'payment_pending',
            },
          },
          status: 'processing',
        },
        error: null,
      }),
    };
    readChain.eq.mockReturnValue(readChain);
    const updateChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { session_id: 'agentic_session_1' },
        error: null,
      }),
      select: vi.fn(),
    };
    updateChain.eq.mockReturnValue(updateChain);
    updateChain.select.mockReturnValue(updateChain);
    const update = vi.fn(() => updateChain);
    const from = vi.fn(() => ({ select: vi.fn(() => readChain), update }));

    const result = await markAgenticPaystackDvaSessionPaid({
      gatewayReference: 'paystack-ref-1',
      supabase: { from } as never,
      transaction: {
        merchant_id: 'merchant-1',
        metadata: {
          agentic_checkout_session_id: 'agentic_session_1',
          agentic_virtual_account_number: '9930000902',
          transaction_type: 'agentic_checkout_payment',
        },
        order_id: 'order-1',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          agentic: expect.objectContaining({ payment_state: 'paid' }),
        }),
        status: 'completed',
      })
    );
  });
});
