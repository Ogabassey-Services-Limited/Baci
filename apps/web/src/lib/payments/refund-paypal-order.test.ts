import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initiatePaypalOrderRefund } from './paypal-order-refund';
import { refundPaypalOrder } from './refund-paypal-order';
import { restorePrepaidTender } from './refund-paypal-prepaid';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('./paypal-order-refund', () => ({
  initiatePaypalOrderRefund: vi.fn(),
}));

vi.mock('./refund-paypal-prepaid', () => ({
  restorePrepaidTender: vi.fn(),
}));

const MERCHANT_ID = 'm1';
const ORDER_ID = 'o1';

function buildSupabase({
  order,
  savings = [],
  insertError = null,
}: {
  order: Record<string, unknown> | null;
  savings?: Array<{ amount: number }>;
  insertError?: unknown;
}) {
  let table = '';
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () =>
      Promise.resolve({ data: table === 'orders' ? order : null, error: null }),
    insert: (row: Record<string, unknown>) => {
      inserts.push({ table, row });
      return Promise.resolve({ error: insertError });
    },
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable query-builder mock
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        data: table === 'customer_savings_redemptions' ? savings : null,
        error: null,
      }).then(resolve),
  };
  const client = {
    from: (t: string) => {
      table = t;
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, inserts };
}

const ORDER = { id: ORDER_ID, order_number: 'BACI-1', currency: 'NGN' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(initiatePaypalOrderRefund).mockResolvedValue({
    success: true,
    refundId: 'RF-1',
    refundIds: ['RF-1'],
  });
  vi.mocked(restorePrepaidTender).mockResolvedValue({
    restored: 15000,
    walletCreditId: 'wc-1',
    savingsRestored: true,
  });
});

describe('refundPaypalOrder (mixed-tender split)', () => {
  it('splits refund by tender from the persisted paypal_split and records per-channel audit rows (F-74)', async () => {
    const { client, inserts } = buildSupabase({
      order: {
        total: 130000,
        wallet_amount_used: 15000,
        customer_id: 'cust-1',
      },
    });

    const result = await refundPaypalOrder({
      supabase: client,
      merchantId: MERCHANT_ID,
      order: ORDER,
      transaction: {
        gateway_response: { purchase_units: [] },
        metadata: {
          paypal_split: { paypalResidualPaid: 50000, prepaidPaid: 15000 },
        },
      },
      reason: 'Order cancelled',
    });

    expect(result).toMatchObject({
      success: true,
      paypalRefunded: 50000,
      prepaidRestored: 15000,
      totalRefunded: 65000,
      paypalRefundIds: ['RF-1'],
      savingsRestored: true,
    });
    // The prepaid leg is restored to the customer wallet, not left consumed.
    expect(restorePrepaidTender).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ prepaidPaid: 15000, customerId: 'cust-1' })
    );
    // One audit row per channel — never a single row claiming the whole total.
    const gateways = inserts.map((i) => i.row.gateway);
    expect(gateways).toEqual(['paypal', 'wallet']);
    expect(inserts[0].row.amount).toBe(50000);
    expect(inserts[1].row.amount).toBe(15000);
  });

  it('falls back to recomputing the split from wallet + savings when paypal_split is absent', async () => {
    const { client } = buildSupabase({
      order: {
        total: 130000,
        wallet_amount_used: 30000,
        customer_id: 'cust-1',
      },
      savings: [{ amount: 20000 }],
    });

    await refundPaypalOrder({
      supabase: client,
      merchantId: MERCHANT_ID,
      order: ORDER,
      transaction: { gateway_response: {}, metadata: {} },
      reason: 'Order cancelled',
    });

    // prepaid = wallet(30k) + savings(20k) = 50k; residual = 130k - 50k = 80k.
    expect(restorePrepaidTender).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ prepaidPaid: 50000, savingsAmountUsed: 20000 })
    );
    expect(initiatePaypalOrderRefund).toHaveBeenCalledTimes(1);
  });

  it('reports failure when the PayPal leg fails but still records nothing for that leg', async () => {
    vi.mocked(initiatePaypalOrderRefund).mockResolvedValue({
      success: false,
      error: 'PayPal capture reference not found for this order',
    });
    const { client, inserts } = buildSupabase({
      order: {
        total: 130000,
        wallet_amount_used: 15000,
        customer_id: 'cust-1',
      },
    });

    const result = await refundPaypalOrder({
      supabase: client,
      merchantId: MERCHANT_ID,
      order: ORDER,
      transaction: {
        gateway_response: {},
        metadata: {
          paypal_split: { paypalResidualPaid: 50000, prepaidPaid: 15000 },
        },
      },
      reason: 'Order cancelled',
    });

    expect(result.success).toBe(false);
    expect(result.paypalRefunded).toBe(0);
    // Only the wallet (prepaid) audit row is written; no PayPal row.
    expect(inserts.map((i) => i.row.gateway)).toEqual(['wallet']);
    expect(result.error).toContain('PayPal capture reference not found');
  });

  it('surfaces an accepted pending refund only after the prepaid leg is complete', async () => {
    vi.mocked(initiatePaypalOrderRefund).mockResolvedValue({
      success: false,
      pending: true,
      pendingRefundIds: ['RF-PENDING'],
      error: 'PayPal refund is pending',
    });
    const { client } = buildSupabase({
      order: {
        total: 130000,
        wallet_amount_used: 15000,
        customer_id: 'cust-1',
      },
    });

    const result = await refundPaypalOrder({
      supabase: client,
      merchantId: MERCHANT_ID,
      order: ORDER,
      transaction: {
        gateway_response: {},
        metadata: {
          paypal_split: { paypalResidualPaid: 50000, prepaidPaid: 15000 },
        },
      },
      reason: 'Order cancelled',
    });

    expect(result).toMatchObject({
      success: false,
      refundPending: true,
      pendingRefundIds: ['RF-PENDING'],
      prepaidRestored: 15000,
    });
  });

  it('surfaces a pending PayPal refund while prepaid restoration still needs retrying', async () => {
    vi.mocked(initiatePaypalOrderRefund).mockResolvedValue({
      success: false,
      pending: true,
      pendingRefundIds: ['RF-PENDING'],
      error: 'PayPal refund is pending',
    });
    vi.mocked(restorePrepaidTender).mockResolvedValue({
      restored: 0,
      savingsRestored: false,
    });
    const { client } = buildSupabase({
      order: {
        total: 130000,
        wallet_amount_used: 15000,
        customer_id: 'cust-1',
      },
    });

    const result = await refundPaypalOrder({
      supabase: client,
      merchantId: MERCHANT_ID,
      order: ORDER,
      transaction: {
        gateway_response: {},
        metadata: {
          paypal_split: { paypalResidualPaid: 50000, prepaidPaid: 15000 },
        },
      },
      reason: 'Order cancelled',
    });

    expect(result).toMatchObject({
      success: false,
      refundPending: true,
      pendingRefundIds: ['RF-PENDING'],
      prepaidRestored: 0,
    });
  });

  it('reports failure when the prepaid leg cannot be fully restored', async () => {
    vi.mocked(restorePrepaidTender).mockResolvedValue({
      restored: 0,
      savingsRestored: false,
    });
    const { client } = buildSupabase({
      order: { total: 130000, wallet_amount_used: 15000, customer_id: null },
    });

    const result = await refundPaypalOrder({
      supabase: client,
      merchantId: MERCHANT_ID,
      order: ORDER,
      transaction: {
        gateway_response: {},
        metadata: {
          paypal_split: { paypalResidualPaid: 50000, prepaidPaid: 15000 },
        },
      },
      reason: 'Order cancelled',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      'Prepaid tender could not be fully restored'
    );
  });
});
