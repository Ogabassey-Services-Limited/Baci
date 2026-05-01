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

function createUpdateChain(
  result: { data: unknown; error: unknown } = {
    data: { session_id: 'agentic_session_1' },
    error: null,
  }
) {
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
    maybeSingle: vi.fn().mockResolvedValue(result),
  });

  return chain;
}

describe('agentic checkout order finalization claim', () => {
  it('builds a deterministic claim id from retry-stable identifiers', () => {
    expect(
      buildOrderFinalizationClaim({
        idempotencyKey: 'idem-1',
        requestId: 'req_123',
        sessionId: 'agentic_session_1',
      })
    ).toBe(
      'agentic_order_e403dbfb1fb1cf57ecde53f42ed6c1dfdb84955aaf8db72c0f06ed1b972fdafa'
    );
    expect(
      buildOrderFinalizationClaim({
        idempotencyKey: 'idem-1',
        requestId: 'req_456',
        sessionId: 'agentic_session_1',
      })
    ).toBe(
      'agentic_order_e403dbfb1fb1cf57ecde53f42ed6c1dfdb84955aaf8db72c0f06ed1b972fdafa'
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

  it('returns not claimed when finalization claim update matches no rows', async () => {
    const chain = createUpdateChain({ data: null, error: null });
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

    expect(result).toEqual({ claimed: false, error: null });
  });

  it('reclaims an existing matching order-finalizing claim', async () => {
    const initialClaimChain = createUpdateChain({ data: null, error: null });
    const existingClaimChain = createUpdateChain({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });
    const updateSpy = vi
      .fn()
      .mockReturnValueOnce(initialClaimChain)
      .mockReturnValueOnce(existingClaimChain);
    const supabase = {
      from: vi.fn(() => ({ update: updateSpy })),
    };

    const result = await claimAgenticOrderFinalization({
      buyer,
      dvaAccount,
      finalizationClaim: 'claim-1',
      merchantId: 'merchant-1',
      metadata: {
        agentic: {
          finalization_claim: 'claim-1',
          payment_state: 'order_finalizing',
        },
      },
      sessionId: 'agentic_session_1',
      supabase: supabase as never,
    });

    expect(result).toEqual({ claimed: true, error: null });
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(existingClaimChain.contains).toHaveBeenCalledWith('metadata', {
      agentic: {
        finalization_claim: 'claim-1',
        payment_state: 'order_finalizing',
      },
    });
  });

  it('returns Supabase errors from finalization claim writes', async () => {
    const claimError = { message: 'claim failed' };
    const chain = createUpdateChain({ data: null, error: claimError });
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

    expect(result).toEqual({ claimed: false, error: claimError });
  });
});
