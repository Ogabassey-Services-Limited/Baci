import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initiatePaypalOrderRefund } from '@/lib/payments/paypal-order-refund';
import { initiateRefund as initiatePaystackRefund } from '@/lib/paystack';
import {
  processOrderCancellationRefund,
  type RefundableOrder,
} from './order-cancellation-refund';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/paystack', () => ({
  initiateRefund: vi.fn(),
}));

vi.mock('@/lib/payments/paypal-order-refund', () => ({
  initiatePaypalOrderRefund: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const ORDER: RefundableOrder = {
  id: 'order-1',
  merchant_id: 'merchant-1',
  order_number: 'BACI-1002',
  currency: 'NGN',
  amount_paid: 65000,
  payment_status: 'paid',
};

/**
 * Builds a Supabase test double where `from('transactions')` serves both the
 * completed-payment lookup (`.select().eq().eq().eq().single()`) and the refund
 * audit insert (`.insert()`).
 */
function buildSupabase(opts: { transaction?: unknown; insertError?: unknown }) {
  const insert = vi.fn(() =>
    Promise.resolve({ error: opts.insertError ?? null })
  );
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({
        data: opts.transaction ?? null,
        error: opts.transaction ? null : { message: 'not found' },
      })
    ),
    insert,
  };
  return { from: vi.fn(() => chain), _insert: insert };
}

describe('processOrderCancellationRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(initiatePaystackRefund).mockResolvedValue({
      success: true,
      data: { id: 987 },
    } as never);
    vi.mocked(initiatePaypalOrderRefund).mockResolvedValue({
      success: true,
      refundId: 'REFUND-1',
    });
  });

  it('does not attempt a refund when nothing was paid', async () => {
    const supabase = buildSupabase({});

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      { ...ORDER, amount_paid: 0 },
      undefined
    );

    expect(result).toEqual({ attempted: false, success: false, amount: 0 });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('reports an attempt but no success when the order is not marked paid', async () => {
    const supabase = buildSupabase({});

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      { ...ORDER, payment_status: 'unpaid' },
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: false,
      amount: 65000,
    });
  });

  it('refunds a paid Paystack order and records the audit row', async () => {
    const supabase = buildSupabase({
      transaction: {
        gateway: 'paystack',
        gateway_reference: 'PSK-REF',
        gateway_response: null,
      },
    });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      'Customer changed mind'
    );

    expect(result).toEqual({
      attempted: true,
      success: true,
      amount: 65000,
      refundId: 987,
    });
    expect(initiatePaystackRefund).toHaveBeenCalledWith(
      'PSK-REF',
      6500000, // kobo
      'Customer changed mind'
    );
    expect(supabase._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_type: 'refund',
        gateway: 'paystack',
        gateway_reference: '987',
        amount: 65000,
      })
    );
  });

  it('refunds a paid PayPal order through the BYOK refund helper', async () => {
    const supabase = buildSupabase({
      transaction: {
        gateway: 'paypal',
        gateway_reference: 'PP-ORD-1',
        gateway_response: { purchase_units: [] },
      },
    });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: true,
      amount: 65000,
      refundId: 'REFUND-1',
    });
    expect(initiatePaypalOrderRefund).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      gatewayResponse: { purchase_units: [] },
      reason: 'Order cancelled',
    });
    expect(supabase._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway: 'paypal',
        gateway_reference: 'REFUND-1',
      })
    );
  });

  it('surfaces a PayPal refund failure without writing an audit row', async () => {
    vi.mocked(initiatePaypalOrderRefund).mockResolvedValue({
      success: false,
      error: 'PayPal capture reference not found for this order',
    });
    const supabase = buildSupabase({
      transaction: {
        gateway: 'paypal',
        gateway_reference: 'PP-ORD-1',
        gateway_response: {},
      },
    });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: false,
      amount: 65000,
      error: 'PayPal capture reference not found for this order',
    });
    expect(supabase._insert).not.toHaveBeenCalled();
  });

  it('flags auditRecordFailed when the refund succeeds but the audit insert fails', async () => {
    const supabase = buildSupabase({
      transaction: {
        gateway: 'paypal',
        gateway_reference: 'PP-ORD-1',
        gateway_response: {},
      },
      insertError: { message: 'db down' },
    });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: true,
      amount: 65000,
      refundId: 'REFUND-1',
      auditRecordFailed: true,
    });
  });

  it('rejects an unsupported gateway', async () => {
    const supabase = buildSupabase({
      transaction: {
        gateway: 'stripe',
        gateway_reference: 'STR-1',
        gateway_response: null,
      },
    });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: false,
      amount: 65000,
      error: 'Unsupported gateway: stripe',
    });
    expect(supabase._insert).not.toHaveBeenCalled();
  });

  it('reports failure when no completed payment transaction exists', async () => {
    const supabase = buildSupabase({ transaction: null });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: false,
      amount: 65000,
      error: 'No completed payment transaction found',
    });
  });
});
