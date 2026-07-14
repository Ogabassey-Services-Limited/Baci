import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drainFailedPaidOrderSideEffects } from '@/lib/payments/drain-failed-paid-order-side-effects';

const mocks = vi.hoisted(() => ({
  finalizeOrderGatewayPayment: vi.fn(),
  retireTerminalSideEffectDrain: vi.fn(),
  verifyGatewayCharge: vi.fn(),
}));

vi.mock('@/lib/payments/finalize-order-gateway-payment', () => ({
  finalizeOrderGatewayPayment: mocks.finalizeOrderGatewayPayment,
}));
vi.mock('@/lib/payments/verify-gateway-charge', () => ({
  verifyGatewayCharge: mocks.verifyGatewayCharge,
}));
vi.mock('@/lib/payments/retire-terminal-side-effect-drain', () => ({
  retireTerminalSideEffectDrain: mocks.retireTerminalSideEffectDrain,
}));

const failedRow = {
  order_id: 'order-1',
  transaction_id: 'txn-1',
  transactions: {
    amount: '58290.60',
    gateway: 'paystack',
    gateway_reference: 'REF-1',
    gateway_response: { status: 'success' },
    id: 'txn-1',
    merchant_id: 'merchant-1',
    order_id: 'order-1',
    platform_fee: 1165.81,
  },
  orders: { cancelled_at: null, id: 'order-1', payment_status: 'paid' },
};

function buildSupabase(result: { data?: unknown[]; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'not', 'is', 'lt', 'in']) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  // `.limit()` is the terminal call in the drain's query chain.
  builder.limit = vi
    .fn()
    .mockResolvedValue({ data: null, error: null, ...result });
  return {
    from: vi.fn().mockReturnValue(builder),
  } as unknown as SupabaseClient;
}

const scheduleAfter = (task: () => Promise<void>) => {
  void task();
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('drainFailedPaidOrderSideEffects', () => {
  it('throws when the failed-row lookup errors', async () => {
    const supabase = buildSupabase({ error: { message: 'db down' } });

    await expect(
      drainFailedPaidOrderSideEffects({ scheduleAfter, supabase })
    ).rejects.toThrow('failed_side_effect_lookup_failed');
  });

  it('returns an empty summary when no failed rows exist', async () => {
    const supabase = buildSupabase({ data: [] });

    const summary = await drainFailedPaidOrderSideEffects({
      scheduleAfter,
      supabase,
    });

    expect(summary).toEqual({ drained: [], failed: [], skipped: [] });
    expect(mocks.finalizeOrderGatewayPayment).not.toHaveBeenCalled();
  });

  it('re-runs the finalizer once per order and reports the drain', async () => {
    const secondStepSameOrder = { ...failedRow };
    const supabase = buildSupabase({
      data: [failedRow, secondStepSameOrder],
    });
    mocks.finalizeOrderGatewayPayment.mockResolvedValue({
      healed: false,
      kind: 'completed',
      orderNumber: 'ORD-1',
    });

    const summary = await drainFailedPaidOrderSideEffects({
      scheduleAfter,
      supabase,
    });

    expect(mocks.finalizeOrderGatewayPayment).toHaveBeenCalledTimes(1);
    expect(mocks.finalizeOrderGatewayPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'cron:reconcile-gateway-paid-orders:drain',
        orderId: 'order-1',
        wonTransactionFlip: false,
      })
    );
    expect(summary.drained).toEqual([{ orderId: 'order-1' }]);
    const firstQuery = vi.mocked(supabase.from).mock.results[0]?.value as {
      in: ReturnType<typeof vi.fn>;
    };
    expect(firstQuery.in).toHaveBeenCalledWith('step', [
      'paid_email',
      'ad_tracking_conversion',
      'merchant_settlement',
    ]);
  });

  it('skips gateways the finalizer cannot handle', async () => {
    const juicywayRow = {
      ...failedRow,
      transactions: { ...failedRow.transactions, gateway: 'juicyway' },
    };
    const supabase = buildSupabase({ data: [juicywayRow] });

    const summary = await drainFailedPaidOrderSideEffects({
      scheduleAfter,
      supabase,
    });

    expect(summary.skipped).toEqual([
      { orderId: 'order-1', reason: 'unhealable_gateway' },
    ]);
    expect(mocks.finalizeOrderGatewayPayment).not.toHaveBeenCalled();
  });

  it('drains stale claimed rows a crashed worker left behind', async () => {
    // First query (failed rows) returns nothing; second (stale claims)
    // returns the abandoned row.
    const results = [
      { data: [], error: null },
      { data: [failedRow], error: null },
    ];
    const from = vi.fn(() => {
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'not', 'is', 'lt', 'in']) {
        builder[method] = vi.fn().mockReturnValue(builder);
      }
      builder.limit = vi
        .fn()
        .mockResolvedValue(results.shift() ?? { data: [], error: null });
      return builder;
    });
    const supabase = { from } as unknown as SupabaseClient;
    mocks.finalizeOrderGatewayPayment.mockResolvedValue({
      healed: false,
      kind: 'completed',
      orderNumber: 'ORD-1',
    });

    const summary = await drainFailedPaidOrderSideEffects({
      scheduleAfter,
      supabase,
    });

    expect(summary.drained).toEqual([{ orderId: 'order-1' }]);
    expect(mocks.finalizeOrderGatewayPayment).toHaveBeenCalledTimes(1);
  });

  it('records finalizer failures without aborting the run', async () => {
    const supabase = buildSupabase({ data: [failedRow] });
    mocks.finalizeOrderGatewayPayment.mockResolvedValue({
      error: 'x',
      kind: 'order_fetch_failed',
    });

    const summary = await drainFailedPaidOrderSideEffects({
      scheduleAfter,
      supabase,
    });

    expect(summary.failed).toEqual([
      { orderId: 'order-1', reason: 'order_fetch_failed' },
    ]);
  });

  it('re-verifies a completed payment before draining without stored gateway evidence', async () => {
    const missingEvidenceRow = {
      ...failedRow,
      transactions: { ...failedRow.transactions, gateway_response: null },
    };
    const supabase = buildSupabase({ data: [missingEvidenceRow] });
    mocks.verifyGatewayCharge.mockResolvedValue({
      amount: 58290.6,
      currency: 'NGN',
      ok: true,
      response: { fees: 123, status: 'success' },
    });
    mocks.finalizeOrderGatewayPayment.mockResolvedValue({
      healed: false,
      kind: 'completed',
      orderNumber: 'ORD-1',
    });

    const summary = await drainFailedPaidOrderSideEffects({
      scheduleAfter,
      supabase,
    });

    expect(mocks.verifyGatewayCharge).toHaveBeenCalledWith('paystack', 'REF-1');
    expect(mocks.finalizeOrderGatewayPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayResponse: { fees: 123, status: 'success' },
      })
    );
    expect(summary.drained).toEqual([{ orderId: 'order-1' }]);
  });

  it('skips a drain when missing gateway evidence cannot be re-verified', async () => {
    const missingEvidenceRow = {
      ...failedRow,
      transactions: { ...failedRow.transactions, gateway_response: null },
    };
    const supabase = buildSupabase({ data: [missingEvidenceRow] });
    mocks.verifyGatewayCharge.mockResolvedValue({
      ok: false,
      reason: 'paystack_verification_unavailable',
    });

    const summary = await drainFailedPaidOrderSideEffects({
      scheduleAfter,
      supabase,
    });

    expect(summary.skipped).toEqual([
      { orderId: 'order-1', reason: 'paystack_verification_unavailable' },
    ]);
    expect(mocks.finalizeOrderGatewayPayment).not.toHaveBeenCalled();
  });

  it('retires terminal verification failures with a durable review', async () => {
    const missingEvidenceRow = {
      ...failedRow,
      transactions: {
        ...failedRow.transactions,
        gateway_response: null,
        metadata: null,
      },
    };
    const supabase = buildSupabase({ data: [missingEvidenceRow] });
    mocks.verifyGatewayCharge.mockResolvedValue({
      gatewayStatus: 'failed',
      ok: false,
      reason: 'gateway_status_not_success',
    });
    mocks.retireTerminalSideEffectDrain.mockResolvedValue(true);

    const summary = await drainFailedPaidOrderSideEffects({
      scheduleAfter,
      supabase,
    });

    expect(mocks.retireTerminalSideEffectDrain).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        resolution: 'gateway_verification_negative',
        transaction: expect.objectContaining({ id: 'txn-1' }),
      })
    );
    expect(summary.skipped).toEqual([
      { orderId: 'order-1', reason: 'gateway_status_not_success' },
    ]);
  });
});
