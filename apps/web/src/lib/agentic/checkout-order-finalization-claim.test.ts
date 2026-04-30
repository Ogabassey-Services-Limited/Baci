import { describe, expect, it, vi } from 'vitest';
import {
  buildOrderFinalizationClaim,
  claimAgenticOrderFinalization,
} from '@/lib/agentic/checkout-order-finalization-claim';

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

function createUpdateChain() {
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
    maybeSingle: vi.fn().mockResolvedValue({
      data: { session_id: 'agentic_session_1' },
      error: null,
    }),
  });

  return chain;
}

describe('agentic checkout order finalization claim', () => {
  it('builds a deterministic claim id from request identifiers', () => {
    expect(
      buildOrderFinalizationClaim({
        idempotencyKey: 'idem-1',
        requestId: 'req_123',
        sessionId: 'agentic_session_1',
      })
    ).toBe(
      'agentic_order_09f22d18903e07480c6b63d1a4209fcdb0e324d93eb208db54c902c0a64df6aa'
    );
  });

  it('only claims sessions that are payment-account-ready and have no order', async () => {
    const chain = createUpdateChain();
    const supabase = {
      from: vi.fn(() => ({ update: vi.fn(() => chain) })),
    };

    const result = await claimAgenticOrderFinalization({
      buyer,
      dvaAccount,
      finalizationClaim: 'claim-1',
      merchantId: 'merchant-1',
      metadata: { agentic: { payment_state: 'payment_account_ready' } },
      sessionId: 'agentic_session_1',
      supabase: supabase as never,
    });

    expect(result.claimed).toBe(true);
    expect(chain.is).toHaveBeenCalledWith('order_id', null);
    expect(chain.contains).toHaveBeenCalledWith('metadata', {
      agentic: { payment_state: 'payment_account_ready' },
    });
  });
});
