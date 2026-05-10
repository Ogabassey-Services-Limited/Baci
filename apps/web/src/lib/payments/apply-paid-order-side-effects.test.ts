import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyPaidOrderSideEffects,
  type SideEffectStep,
  type StepExecutor,
} from '@/lib/payments/apply-paid-order-side-effects';

// ---------------------------------------------------------------------------
// Mock factory — keeps tests readable. Records every supabase call so we
// can assert on the side-effect plumbing (claim/mark-completed/mark-failed)
// without coupling to private chain shapes.
// ---------------------------------------------------------------------------

type ClaimRpcArgs = {
  p_order_id: string;
  p_transaction_id: string;
  p_step: SideEffectStep;
  p_claim_token: string;
  p_claimed_by: string;
};

type ClaimRpcResponse = { we_won: boolean; current_status: string };

type UpdatedRow = { order_id: string };

type MockOpts = {
  orderId: string;
  // Per-(step, attempt) responses. Defaults: claim wins, mark returns 1 row.
  claim?: (args: ClaimRpcArgs) => ClaimRpcResponse;
  markCompletedReturns?: (step: SideEffectStep, token: string) => UpdatedRow[];
  markCompletedError?: (
    step: SideEffectStep,
    token: string
  ) => { message: string } | null;
  markFailedReturns?: (step: SideEffectStep, token: string) => UpdatedRow[];
};

type MockState = {
  claimCalls: ClaimRpcArgs[];
  markCompletedCalls: Array<{
    step: SideEffectStep;
    token: string;
    patch: Record<string, unknown>;
  }>;
  markFailedCalls: Array<{
    step: SideEffectStep;
    token: string;
    patch: Record<string, unknown>;
  }>;
};

function createMockSupabase(opts: MockOpts) {
  const state: MockState = {
    claimCalls: [],
    markCompletedCalls: [],
    markFailedCalls: [],
  };

  const claimDefault: NonNullable<MockOpts['claim']> = () => ({
    we_won: true,
    current_status: 'claimed',
  });
  const claim = opts.claim ?? claimDefault;
  const markCompletedReturns =
    opts.markCompletedReturns ??
    ((_s: SideEffectStep, _t: string) => [{ order_id: opts.orderId }]);
  const markFailedReturns =
    opts.markFailedReturns ??
    ((_s: SideEffectStep, _t: string) => [{ order_id: opts.orderId }]);

  const supabase = {
    from(table: string) {
      if (table === 'payment_side_effects') {
        return {
          update(patch: Record<string, unknown>) {
            const eqs: Record<string, string> = {};
            const chain: Record<string, unknown> = {};
            chain.eq = (col: string, val: string) => {
              eqs[col] = val;
              return chain;
            };
            chain.select = (_cols: string) => ({
              // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock — the helper does `await supabase.from(...).update(...).eq(...).select(...)` and we need the chain leaf to resolve as a promise.
              then(resolve: (v: unknown) => void) {
                const step = eqs.step as SideEffectStep;
                const token = eqs.claim_token;
                if (patch.status === 'completed') {
                  state.markCompletedCalls.push({ step, token, patch });
                  const injectedError = opts.markCompletedError?.(step, token);
                  if (injectedError) {
                    resolve({ data: null, error: injectedError });
                  } else {
                    resolve({
                      data: markCompletedReturns(step, token),
                      error: null,
                    });
                  }
                } else {
                  state.markFailedCalls.push({ step, token, patch });
                  resolve({
                    data: markFailedReturns(step, token),
                    error: null,
                  });
                }
              },
            });
            return chain;
          },
        };
      }
      throw new Error(`unmocked table: ${table}`);
    },
    rpc(name: string, args: ClaimRpcArgs) {
      if (name !== 'claim_payment_side_effect') {
        throw new Error(`unmocked rpc: ${name}`);
      }
      state.claimCalls.push(args);
      const response = claim(args);
      return {
        single: () => Promise.resolve({ data: response, error: null }),
      };
    },
  };

  return { supabase, state };
}

const txn = {
  id: 'txn-1',
  order_id: 'order-1',
  merchant_id: 'merchant-1',
  gateway_reference: 'BAC-TEST',
  amount: 1100,
};

const consistentOrder = {
  id: 'order-1',
  merchant_id: 'merchant-1',
  payment_status: 'paid' as const,
  tax_basis: 'exclusive' as const,
  subtotal: 1000,
  shipping_fee: 100,
  gift_wrapping_fee: 0,
  tax_amount: 0,
  discount_amount: 0,
  total: 1100,
};

const inconsistentOrder = {
  ...consistentOrder,
  tax_basis: null as null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('applyPaidOrderSideEffects — clean run', () => {
  it('claims, runs, and marks completed every wired executor', async () => {
    const emailExec = vi.fn<StepExecutor>(async () => ({ message_id: 'm-1' }));
    const settlementExec = vi.fn<StepExecutor>(async () => ({
      settlement_id: 's-1',
    }));
    const adExec = vi.fn<StepExecutor>(async () => ({}));

    const { supabase, state } = createMockSupabase({ orderId: txn.order_id });

    const result = await applyPaidOrderSideEffects({
      supabase: supabase as never,
      order: consistentOrder,
      transaction: txn,
      gatewayResponse: { fees: 1500 },
      actor: 'webhook:req-abc',
      executors: {
        paid_email: emailExec,
        merchant_settlement: settlementExec,
        ad_tracking_conversion: adExec,
      },
    });

    expect(emailExec).toHaveBeenCalledTimes(1);
    expect(settlementExec).toHaveBeenCalledTimes(1);
    expect(adExec).toHaveBeenCalledTimes(1);

    expect(state.claimCalls).toHaveLength(3);
    expect(state.markCompletedCalls).toHaveLength(3);
    expect(state.markFailedCalls).toHaveLength(0);

    expect(result.ranSteps.sort()).toEqual(
      ['ad_tracking_conversion', 'merchant_settlement', 'paid_email'].sort()
    );
    expect(result.failedSteps).toEqual([]);
    expect(result.skippedSteps).toEqual([]);
    expect(result.concurrentTakeoverSteps).toEqual([]);
  });
});

describe('applyPaidOrderSideEffects — replay (idempotent)', () => {
  it('skips steps already marked completed without invoking the executor', async () => {
    const emailExec = vi.fn<StepExecutor>();
    const { supabase, state } = createMockSupabase({
      orderId: txn.order_id,
      claim: () => ({ we_won: false, current_status: 'completed' }),
    });

    const result = await applyPaidOrderSideEffects({
      supabase: supabase as never,
      order: consistentOrder,
      transaction: txn,
      gatewayResponse: { fees: 0 },
      actor: 'webhook:replay',
      executors: { paid_email: emailExec },
    });

    expect(emailExec).not.toHaveBeenCalled();
    expect(state.markCompletedCalls).toHaveLength(0);
    expect(result.skippedSteps).toEqual(['paid_email']);
    expect(result.ranSteps).toEqual([]);
  });
});

describe('applyPaidOrderSideEffects — partial failure (one executor throws)', () => {
  it('marks the throwing step failed and continues with the rest', async () => {
    const emailExec = vi.fn<StepExecutor>(async () => ({}));
    const settlementExec = vi.fn<StepExecutor>(() => {
      throw new Error('rpc_timeout');
    });

    const { supabase, state } = createMockSupabase({ orderId: txn.order_id });

    const result = await applyPaidOrderSideEffects({
      supabase: supabase as never,
      order: consistentOrder,
      transaction: txn,
      gatewayResponse: { fees: 1500 },
      actor: 'webhook:req-1',
      executors: {
        paid_email: emailExec,
        merchant_settlement: settlementExec,
      },
    });

    expect(emailExec).toHaveBeenCalledTimes(1);
    expect(settlementExec).toHaveBeenCalledTimes(1);

    expect(result.ranSteps).toEqual(['paid_email']);
    expect(result.failedSteps).toEqual([
      { step: 'merchant_settlement', error: 'rpc_timeout' },
    ]);
    expect(state.markFailedCalls).toHaveLength(1);
    expect(state.markFailedCalls[0]?.patch).toMatchObject({
      status: 'failed',
      error: 'rpc_timeout',
    });
  });
});

describe('applyPaidOrderSideEffects — concurrent takeover (loser sees 0 rows)', () => {
  it('reports concurrent_takeover when the mark-completed UPDATE matches no rows', async () => {
    const emailExec = vi.fn<StepExecutor>(async () => ({}));

    const { supabase, state } = createMockSupabase({
      orderId: txn.order_id,
      // Both workers win the claim (race in DB), but only one wins the
      // mark-completed UPDATE — model the loser by returning 0 rows.
      markCompletedReturns: () => [],
    });

    const result = await applyPaidOrderSideEffects({
      supabase: supabase as never,
      order: consistentOrder,
      transaction: txn,
      gatewayResponse: { fees: 0 },
      actor: 'webhook:loser',
      executors: { paid_email: emailExec },
    });

    expect(emailExec).toHaveBeenCalledTimes(1);
    expect(state.markCompletedCalls).toHaveLength(1);
    expect(result.concurrentTakeoverSteps).toEqual(['paid_email']);
    expect(result.ranSteps).toEqual(['paid_email']);
  });
});

describe('applyPaidOrderSideEffects — Δ-31 inconsistent (tax_basis NULL)', () => {
  it('short-circuits firs_invoice + loyalty_points before executor; lets settlement/email/ad-tracking complete', async () => {
    const emailExec = vi.fn<StepExecutor>(async () => ({}));
    const firsExec = vi.fn<StepExecutor>(async () => ({}));
    const loyaltyExec = vi.fn<StepExecutor>(async () => ({}));
    const settlementExec = vi.fn<StepExecutor>(async () => ({}));
    const adExec = vi.fn<StepExecutor>(async () => ({}));

    const { supabase, state } = createMockSupabase({ orderId: txn.order_id });

    const result = await applyPaidOrderSideEffects({
      supabase: supabase as never,
      order: inconsistentOrder,
      transaction: txn,
      gatewayResponse: { fees: 0 },
      actor: 'webhook:efosa-shape',
      executors: {
        paid_email: emailExec,
        firs_invoice: firsExec,
        loyalty_points: loyaltyExec,
        ad_tracking_conversion: adExec,
        merchant_settlement: settlementExec,
      },
    });

    expect(firsExec).not.toHaveBeenCalled();
    expect(loyaltyExec).not.toHaveBeenCalled();
    expect(emailExec).toHaveBeenCalledTimes(1);
    expect(adExec).toHaveBeenCalledTimes(1);
    expect(settlementExec).toHaveBeenCalledTimes(1);

    const failedSteps = result.failedSteps.map((f) => f.step).sort();
    expect(failedSteps).toEqual(['firs_invoice', 'loyalty_points']);
    for (const f of result.failedSteps) {
      expect(f.error).toBe('financial_totals_inconsistent');
    }
    // Failure UPDATE must be token-gated (Δ-58).
    expect(state.markFailedCalls).toHaveLength(2);
    for (const c of state.markFailedCalls) {
      expect(c.token).toBeTypeOf('string');
      expect(c.patch).toMatchObject({
        status: 'failed',
        error: 'financial_totals_inconsistent',
      });
    }
  });
});

describe('applyPaidOrderSideEffects — guard clauses', () => {
  it('throws when the order is not paid (caller must flip to paid first)', async () => {
    const { supabase } = createMockSupabase({ orderId: txn.order_id });

    await expect(
      applyPaidOrderSideEffects({
        supabase: supabase as never,
        order: { ...consistentOrder, payment_status: 'pending' },
        transaction: txn,
        gatewayResponse: {},
        actor: 'webhook:bug',
        executors: { paid_email: vi.fn() },
      })
    ).rejects.toThrow(/order_not_paid/);
  });

  it('throws when transaction.order_id does not match order.id', async () => {
    const { supabase } = createMockSupabase({ orderId: txn.order_id });

    await expect(
      applyPaidOrderSideEffects({
        supabase: supabase as never,
        order: consistentOrder,
        transaction: { ...txn, order_id: 'order-mismatched' },
        gatewayResponse: {},
        actor: 'webhook:bug',
        executors: { paid_email: vi.fn() },
      })
    ).rejects.toThrow(/order_transaction_mismatch/);
  });
});

describe('applyPaidOrderSideEffects — executor succeeds but markCompleted throws (review feedback)', () => {
  // Review feedback: the split-try/catch path I added in commit 52e061d2f9
  // (Δ-78) — executor returns successfully but the markCompleted UPDATE
  // throws (e.g., transient DB blip). The external side effect ALREADY
  // ran; we just couldn't record it. Step lands in failedSteps with
  // error 'mark_completed_threw: <message>' so a replay re-takes the
  // claim; per-integration boundary idempotency catches the duplicate.
  it('records mark_completed_threw failure when DB UPDATE errors after executor succeeded', async () => {
    const emailExec = vi.fn<StepExecutor>(async () => ({ message_id: 'm-1' }));

    const { supabase, state } = createMockSupabase({
      orderId: txn.order_id,
      markCompletedError: () => ({ message: 'connection timed out' }),
    });

    const result = await applyPaidOrderSideEffects({
      supabase: supabase as never,
      order: consistentOrder,
      transaction: txn,
      gatewayResponse: { fees: 0 },
      actor: 'webhook:db-blip',
      executors: { paid_email: emailExec },
    });

    // Executor DID run (side effect happened externally).
    expect(emailExec).toHaveBeenCalledTimes(1);
    // Step recorded as failed with the explicit mark_completed_threw prefix.
    expect(result.failedSteps).toEqual([
      {
        step: 'paid_email',
        error: expect.stringMatching(/^mark_completed_threw:/),
      },
    ]);
    expect(result.ranSteps).toEqual([]);
    // Best-effort markFailed was attempted, token-gated.
    expect(state.markFailedCalls).toHaveLength(1);
    expect(state.markFailedCalls[0]?.patch).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/^mark_completed_threw:/),
    });
  });
});
