import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as paypal from '@/lib/paypal';
import { getPaypalCheckoutCredentials } from './paypal-checkout-credentials';
import * as paypalSweep from './paypal-reconciliation-sweep';
import { sweepStrandedPaypalCaptures } from './paypal-reconciliation-sweep';
import { runPaypalReconcileFunnel } from './paypal-settlement-funnel';
import { retryPendingPaypalRefundPrepaidRecovery } from './retry-pending-paypal-refund-prepaid-recovery';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/payments/paypal-settlement-funnel', () => ({
  runPaypalReconcileFunnel: vi.fn(),
}));

vi.mock('@/lib/payments/paypal-checkout-credentials', () => ({
  getPaypalCheckoutCredentials: vi.fn(),
}));

vi.mock('@/lib/payments/retry-pending-paypal-refund-prepaid-recovery', () => ({
  retryPendingPaypalRefundPrepaidRecovery: vi.fn(),
}));

vi.mock('@/lib/paypal', () => ({
  getRefund: vi.fn(),
}));

const ROW = {
  id: 'txn-1',
  merchant_id: 'm-1',
  order_id: 'o-1',
  gateway_reference: 'PP-1',
};

/** Chainable mock capturing the filters the sweep applies. */
function makeSupabase(result: { data?: unknown; error?: unknown }) {
  const filters: Record<string, unknown> = {};
  const updates: Record<string, unknown>[] = [];
  const builder: Record<string, unknown> = {
    select: () => builder,
    update: (payload: Record<string, unknown>) => {
      updates.push(payload);
      return builder;
    },
    eq: (col: string, val: unknown) => {
      filters[col] = val;
      return builder;
    },
    not: (col: string, op: string, val: unknown) => {
      filters[`not:${col}`] = `${op}:${val}`;
      return builder;
    },
    lt: (col: string, val: unknown) => {
      filters[`lt:${col}`] = val;
      return builder;
    },
    order: () => builder,
    limit: () => Promise.resolve(result),
  };
  return {
    client: { from: () => builder } as never,
    filters,
    updates,
  };
}

function makeRefundSupabase(row: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = [];
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    not: vi.fn(() => query),
    lt: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve({ data: [row], error: null })),
  };
  const update = {
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload);
      return update;
    }),
    eq: vi.fn(() => update),
    // biome-ignore lint/suspicious/noThenProperty: intentional Supabase query-builder thenable
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve({ error: null }).then(resolve, reject),
  };
  const client = {
    from: vi.fn().mockReturnValueOnce(query).mockReturnValueOnce(update),
  } as never;
  return { client, updates };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sweepStrandedPaypalCaptures', () => {
  it('recovers a capture PayPal took but our write path lost', async () => {
    // THE state this exists for: PayPal charged the buyer, the local write died, the
    // row is stuck `pending`, /verify never re-checks it, and there is no webhook.
    // Without this sweep the buyer is charged for an order that never ships.
    const { client } = makeSupabase({ data: [ROW], error: null });
    vi.mocked(runPaypalReconcileFunnel).mockResolvedValue({
      ok: true,
      response: NextResponse.json({ success: true, status: 'success' }),
    });

    const result = await sweepStrandedPaypalCaptures(client);

    expect(runPaypalReconcileFunnel).toHaveBeenCalledWith(client, {
      merchantId: 'm-1',
      orderId: 'o-1',
      paypalOrderId: 'PP-1',
    });
    expect(result).toMatchObject({ scanned: 1, settled: 1, failed: 0 });
  });

  it('leaves a genuinely abandoned checkout alone (PayPal never captured)', async () => {
    const { client, updates } = makeSupabase({ data: [ROW], error: null });
    vi.mocked(runPaypalReconcileFunnel).mockResolvedValue({
      ok: true,
      response: NextResponse.json(
        {
          error: 'PayPal has not captured this order',
          code: 'PAYPAL_NOT_CAPTURED',
        },
        { status: 409 }
      ),
    });

    const result = await sweepStrandedPaypalCaptures(client);

    expect(result).toMatchObject({ scanned: 1, settled: 0, notCaptured: 1 });
    expect(updates).toEqual([
      expect.objectContaining({ updated_at: expect.any(String) }),
    ]);
  });

  it('only ever looks at PayPal PAYMENT rows that are still pending', async () => {
    // Refund audit rows are also gateway=paypal; sweeping one would reconcile
    // against a refund record rather than the buyer's payment.
    const { client, filters } = makeSupabase({ data: [], error: null });

    await sweepStrandedPaypalCaptures(client);

    expect(filters.gateway).toBe('paypal');
    expect(filters.transaction_type).toBe('payment');
    expect(filters.status).toBe('pending');
    expect(filters['lt:updated_at']).toBeTruthy(); // rotates checked rows fairly
  });

  it('one broken row does not stop the rest of the sweep', async () => {
    const { client } = makeSupabase({
      data: [ROW, { ...ROW, id: 'txn-2', order_id: 'o-2' }],
      error: null,
    });
    vi.mocked(runPaypalReconcileFunnel)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        ok: true,
        response: NextResponse.json({ success: true }),
      });

    const result = await sweepStrandedPaypalCaptures(client);

    expect(result).toMatchObject({ scanned: 2, settled: 1, failed: 1 });
  });

  it('throws when it cannot even read the table — a blind sweeper must not report success', async () => {
    const { client } = makeSupabase({ data: null, error: { message: 'down' } });

    await expect(sweepStrandedPaypalCaptures(client)).rejects.toThrow(
      'paypal_sweep_query_failed'
    );
  });
});

describe('sweepPendingPaypalRefunds', () => {
  it('polls stored refund ids and advances the transaction when every refund completes', async () => {
    const getRefund = (
      paypal as unknown as { getRefund: ReturnType<typeof vi.fn> }
    ).getRefund;
    const sweepPendingPaypalRefunds = (
      paypalSweep as unknown as {
        sweepPendingPaypalRefunds?: (client: never) => Promise<{
          completed: number;
        }>;
      }
    ).sweepPendingPaypalRefunds;
    expect(typeof sweepPendingPaypalRefunds).toBe('function');

    vi.mocked(getPaypalCheckoutCredentials).mockResolvedValue({
      clientId: 'cid',
      secretKey: 'secret',
    });
    getRefund.mockResolvedValue({
      success: true,
      data: { id: 'REFUND-P', status: 'COMPLETED' },
    });
    vi.mocked(retryPendingPaypalRefundPrepaidRecovery).mockResolvedValue(true);
    const { client, updates } = makeRefundSupabase({
      id: 'txn-1',
      merchant_id: 'm-1',
      order_id: 'o-1',
      gateway_reference: 'PP-1',
      metadata: {
        existing: true,
        paypal_pending_refund_ids: ['REFUND-P'],
        paypal_restore_prepaid_on_refund_reconcile: true,
      },
    });

    const result = await sweepPendingPaypalRefunds?.(client);

    expect(getRefund).toHaveBeenCalledWith('cid', 'secret', 'REFUND-P', 'live');
    expect(retryPendingPaypalRefundPrepaidRecovery).toHaveBeenCalledWith(
      client,
      {
        merchantId: 'm-1',
        orderId: 'o-1',
        transactionId: 'txn-1',
        transactionMetadata: expect.objectContaining({ existing: true }),
        checkedAt: expect.any(String),
      }
    );
    expect(updates).toEqual([
      expect.objectContaining({
        status: 'refunded',
        metadata: expect.objectContaining({
          paypal_completed_refund_ids: ['REFUND-P'],
        }),
      }),
    ]);
    expect(result?.completed).toBe(1);
  });

  it('keeps the transaction pending when prepaid recovery still fails', async () => {
    const getRefund = vi.mocked(paypal.getRefund);
    vi.mocked(getPaypalCheckoutCredentials).mockResolvedValue({
      clientId: 'cid',
      secretKey: 'secret',
    });
    getRefund.mockResolvedValue({
      success: true,
      data: { id: 'REFUND-P', status: 'COMPLETED' },
    });
    vi.mocked(retryPendingPaypalRefundPrepaidRecovery).mockResolvedValue(false);
    const { client, updates } = makeRefundSupabase({
      id: 'txn-1',
      merchant_id: 'm-1',
      order_id: 'o-1',
      gateway_reference: 'PP-1',
      metadata: {
        paypal_pending_refund_ids: ['REFUND-P'],
        paypal_restore_prepaid_on_refund_reconcile: true,
      },
    });

    const result = await paypalSweep.sweepPendingPaypalRefunds(client);

    expect(result).toMatchObject({ completed: 0, failed: 1 });
    expect(updates).not.toContainEqual(
      expect.objectContaining({ status: 'refunded' })
    );
  });
});
