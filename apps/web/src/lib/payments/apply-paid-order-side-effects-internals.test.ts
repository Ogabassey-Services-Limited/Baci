import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import {
  claimStep,
  markCompleted,
  markFailed,
} from '@/lib/payments/apply-paid-order-side-effects-internals';

type SupabaseMock = Parameters<typeof claimStep>[0];

function createRpcMock(result: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn(() => ({
      single: vi.fn().mockResolvedValue(result),
    })),
  } as unknown as SupabaseMock;
}

function createUpdateChainMock(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  // .update().eq().eq().eq().select('order_id') chain
  const eq3 = vi
    .fn()
    .mockReturnValue({ select: vi.fn().mockResolvedValue(result) });
  const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const update = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ update });
  return {
    supabase: { from } as unknown as SupabaseMock,
    update,
    eq1,
    eq2,
    eq3,
    select,
  };
}

const claimArgs = {
  orderId: 'order-1',
  transactionId: 'txn-1',
  step: 'paid_email' as const,
  token: 'tok-1',
  claimedBy: 'webhook:req-1',
};

describe('claimStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the RPC payload on success', async () => {
    const supabase = createRpcMock({
      data: { we_won: true, current_status: 'claimed' },
      error: null,
    });
    const result = await claimStep(supabase, claimArgs);
    expect(result).toEqual({ we_won: true, current_status: 'claimed' });
    expect(
      (supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc
    ).toHaveBeenCalledWith('claim_payment_side_effect', {
      p_order_id: claimArgs.orderId,
      p_transaction_id: claimArgs.transactionId,
      p_step: claimArgs.step,
      p_claim_token: claimArgs.token,
      p_claimed_by: claimArgs.claimedBy,
    });
  });

  it('throws on RPC error', async () => {
    const supabase = createRpcMock({
      data: null,
      error: { message: 'db down' },
    });
    await expect(claimStep(supabase, claimArgs)).rejects.toThrow(
      /claim_payment_side_effect failed for step paid_email: db down/
    );
  });

  it('throws when RPC returns no data', async () => {
    const supabase = createRpcMock({ data: null, error: null });
    await expect(claimStep(supabase, claimArgs)).rejects.toThrow(/no data/);
  });
});

describe('markCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the updated rows when the token matched', async () => {
    const { supabase, update, eq1 } = createUpdateChainMock({
      data: [{ order_id: 'order-1' }],
      error: null,
    });
    const result = await markCompleted(supabase, {
      orderId: 'order-1',
      step: 'paid_email',
      token: 'tok-1',
      result: { messageId: 'm-1' },
    });
    expect(result.rows).toEqual([{ order_id: 'order-1' }]);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        result: { messageId: 'm-1' },
        error: null,
      })
    );
    expect(eq1).toHaveBeenCalledWith('order_id', 'order-1');
  });

  it('returns empty rows when the token did not match (concurrent takeover)', async () => {
    const { supabase } = createUpdateChainMock({ data: [], error: null });
    const result = await markCompleted(supabase, {
      orderId: 'order-1',
      step: 'merchant_settlement',
      token: 'tok-loser',
      result: null,
    });
    expect(result.rows).toEqual([]);
  });

  it('throws on DB error', async () => {
    const { supabase } = createUpdateChainMock({
      data: null,
      error: { message: 'connection reset' },
    });
    await expect(
      markCompleted(supabase, {
        orderId: 'order-1',
        step: 'paid_email',
        token: 'tok-1',
        result: null,
      })
    ).rejects.toThrow(
      /mark_completed failed for step paid_email: connection reset/
    );
  });
});

describe('markFailed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does NOT throw on DB error; logs and continues so replay can take over', async () => {
    const { supabase } = createUpdateChainMock({
      data: null,
      error: { message: 'transient failure' },
    });
    await expect(
      markFailed(supabase, {
        orderId: 'order-1',
        step: 'firs_invoice',
        token: 'tok-1',
        error: 'financial_totals_inconsistent',
        result: { tax_basis: null },
      })
    ).resolves.toBeUndefined();
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'payment_side_effects: mark_failed UPDATE errored',
        orderId: 'order-1',
        step: 'firs_invoice',
        dbError: 'transient failure',
        stepError: 'financial_totals_inconsistent',
      })
    );
  });

  it('silently completes on a successful UPDATE', async () => {
    const { supabase } = createUpdateChainMock({
      data: [{ order_id: 'order-1' }],
      error: null,
    });
    await expect(
      markFailed(supabase, {
        orderId: 'order-1',
        step: 'loyalty_points',
        token: 'tok-1',
        error: 'financial_totals_inconsistent',
        result: null,
      })
    ).resolves.toBeUndefined();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
});
