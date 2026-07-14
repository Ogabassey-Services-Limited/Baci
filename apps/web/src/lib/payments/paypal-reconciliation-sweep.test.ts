import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sweepStrandedPaypalCaptures } from './paypal-reconciliation-sweep';
import { runPaypalReconcileFunnel } from './paypal-settlement-funnel';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/payments/paypal-settlement-funnel', () => ({
  runPaypalReconcileFunnel: vi.fn(),
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
  const builder: Record<string, unknown> = {
    select: () => builder,
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
  };
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
    const { client } = makeSupabase({ data: [ROW], error: null });
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
  });

  it('only ever looks at PayPal PAYMENT rows that are still pending', async () => {
    // Refund audit rows are also gateway=paypal; sweeping one would reconcile
    // against a refund record rather than the buyer's payment.
    const { client, filters } = makeSupabase({ data: [], error: null });

    await sweepStrandedPaypalCaptures(client);

    expect(filters.gateway).toBe('paypal');
    expect(filters.transaction_type).toBe('payment');
    expect(filters.status).toBe('pending');
    expect(filters['lt:created_at']).toBeTruthy(); // only settled-down rows
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
