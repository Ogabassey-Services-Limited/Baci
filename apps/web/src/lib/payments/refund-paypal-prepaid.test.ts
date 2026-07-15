import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { restorePrepaidTender } from './refund-paypal-prepaid';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

function buildSupabase({
  existing = null,
  creditRows = [{ transaction_id: 'wc-1' }],
  creditError = null,
  savingsReversalError = null,
  savingsAlreadyReversed = false,
  existingReversalReason,
}: {
  existing?: { id: string } | null;
  creditRows?: unknown;
  creditError?: unknown;
  savingsReversalError?: unknown;
  savingsAlreadyReversed?: boolean;
  existingReversalReason?: string;
}) {
  let reversalApplied = savingsAlreadyReversed;
  let reversalWrites = 0;
  let reversalReason = existingReversalReason;
  const rpc = vi.fn(
    (
      name: string,
      args: { p_reason?: string } = {}
    ): Promise<{ data: unknown; error: unknown }> => {
      if (name === 'mark_customer_savings_redemptions_reversed') {
        if (savingsReversalError) {
          return Promise.resolve({
            data: null,
            error: savingsReversalError,
          });
        }
        if (!reversalApplied) {
          reversalApplied = true;
          reversalWrites += 1;
          reversalReason = args.p_reason;
          return Promise.resolve({ data: 1, error: null });
        }
        return Promise.resolve({ data: 0, error: null });
      }
      return Promise.resolve({ data: creditRows, error: creditError });
    }
  );
  type MockQueryBuilder = {
    select: () => MockQueryBuilder;
    eq: () => MockQueryBuilder;
    limit: () => MockQueryBuilder;
    maybeSingle: () => Promise<{
      data: { id: string } | null;
      error: null;
    }>;
  };
  let builder: MockQueryBuilder;
  builder = {
    select: () => builder,
    eq: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve({ data: existing, error: null }),
  };
  const client = {
    from: () => builder,
    rpc,
  };
  return {
    client: client as unknown as SupabaseClient,
    rpc,
    getSavingsAudit: () => ({ reversalReason, reversalWrites }),
  };
}

const base = {
  merchantId: 'm1',
  orderId: 'o1',
  orderNumber: 'BACI-1',
  reason: 'Order cancelled',
};

beforeEach(() => vi.clearAllMocks());

describe('restorePrepaidTender', () => {
  it('returns nothing to restore when prepaidPaid is 0', async () => {
    const { client, rpc } = buildSupabase({});
    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: 'c1',
      prepaidPaid: 0,
      savingsAmountUsed: 0,
    });
    expect(result).toEqual({ restored: 0, savingsRestored: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed when there is prepaid tender but no customer to credit', async () => {
    const { client, rpc } = buildSupabase({});
    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: null,
      prepaidPaid: 15000,
      savingsAmountUsed: 0,
    });
    expect(result).toEqual({ restored: 0, savingsRestored: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('is idempotent: a prior wallet-refund audit row short-circuits a second credit (exactly-once)', async () => {
    const { client, rpc } = buildSupabase({ existing: { id: 'prev-wc' } });
    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: 'c1',
      prepaidPaid: 15000,
      savingsAmountUsed: 0,
    });
    expect(result).toMatchObject({
      restored: 15000,
      walletCreditId: 'prev-wc',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('retries the savings reversal after an earlier wallet credit succeeded', async () => {
    const { client, rpc } = buildSupabase({
      existing: { id: 'prev-wc' },
    });

    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: 'c1',
      prepaidPaid: 15000,
      savingsAmountUsed: 5000,
    });

    expect(result).toMatchObject({
      restored: 15000,
      walletCreditId: 'prev-wc',
      savingsRestored: true,
    });
    expect(rpc).toHaveBeenCalledWith(
      'mark_customer_savings_redemptions_reversed',
      {
        p_merchant_id: 'm1',
        p_order_id: 'o1',
        p_reason: 'Order cancelled',
      }
    );
  });

  it('keeps the wallet result but reports a failed savings-reversal retry', async () => {
    const { client, rpc } = buildSupabase({
      existing: { id: 'prev-wc' },
      savingsReversalError: { message: 'update failed' },
    });

    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: 'c1',
      prepaidPaid: 15000,
      savingsAmountUsed: 5000,
    });

    expect(result).toEqual({
      restored: 15000,
      walletCreditId: 'prev-wc',
      savingsRestored: false,
    });
    expect(rpc).toHaveBeenCalledWith(
      'mark_customer_savings_redemptions_reversed',
      expect.anything()
    );
  });

  it('preserves an existing savings reversal audit while marking unreversed rows', async () => {
    const { client, getSavingsAudit } = buildSupabase({
      existing: { id: 'prev-wc' },
      savingsAlreadyReversed: true,
      existingReversalReason: 'Original cancellation',
    });

    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: 'c1',
      prepaidPaid: 15000,
      savingsAmountUsed: 5000,
      reason: 'Retry after wallet credit',
    });

    expect(result.savingsRestored).toBe(true);
    expect(getSavingsAudit()).toEqual({
      reversalReason: 'Original cancellation',
      reversalWrites: 0,
    });
  });

  it('applies only one savings reversal when cancellation retries race', async () => {
    const { client, getSavingsAudit } = buildSupabase({
      existing: { id: 'prev-wc' },
    });

    const results = await Promise.all([
      restorePrepaidTender(client, {
        ...base,
        customerId: 'c1',
        prepaidPaid: 15000,
        savingsAmountUsed: 5000,
        reason: 'First cancellation',
      }),
      restorePrepaidTender(client, {
        ...base,
        customerId: 'c1',
        prepaidPaid: 15000,
        savingsAmountUsed: 5000,
        reason: 'Concurrent retry',
      }),
    ]);

    expect(results.map((result) => result.savingsRestored)).toEqual([
      true,
      true,
    ]);
    expect(getSavingsAudit()).toEqual({
      reversalReason: 'First cancellation',
      reversalWrites: 1,
    });
  });

  it('credits the wallet for the full prepaid and marks savings reversed', async () => {
    const { client, rpc } = buildSupabase({});
    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: 'c1',
      prepaidPaid: 50000,
      savingsAmountUsed: 20000,
    });
    expect(result).toMatchObject({
      restored: 50000,
      walletCreditId: 'wc-1',
      savingsRestored: true,
    });
    expect(rpc).toHaveBeenCalledWith(
      'credit_customer_wallet',
      expect.objectContaining({
        p_customer_id: 'c1',
        p_merchant_id: 'm1',
        p_amount: 50000,
        p_source_id: 'o1',
        // Must be a source type credit_customer_wallet accepts; 'order' raised
        // 22023 and silently stranded the prepaid refund (Codex pass-8 P1).
        p_source_type: 'order_refund',
      })
    );
  });

  it('does not report restored when the wallet credit RPC errors', async () => {
    const { client } = buildSupabase({ creditError: { message: 'rpc down' } });
    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: 'c1',
      prepaidPaid: 15000,
      savingsAmountUsed: 0,
    });
    expect(result).toEqual({ restored: 0, savingsRestored: false });
  });
});
