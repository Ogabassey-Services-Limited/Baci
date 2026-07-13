import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { completeOrderGatewayPayment } from '@/lib/payments/complete-order-gateway-payment';

function buildSupabaseMock(rpcResult: {
  data?: unknown;
  error?: { message: string } | null;
}) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...rpcResult }),
  } as unknown as SupabaseClient;
}

describe('completeOrderGatewayPayment', () => {
  it('invokes the atomic RPC with the exact parameter names', async () => {
    const supabase = buildSupabaseMock({ data: { order_updated: true } });

    await completeOrderGatewayPayment({
      actor: 'webhook:BAC-REF',
      gatewayResponse: { status: 'success' },
      orderId: 'order-1',
      supabase,
      transactionId: 'txn-1',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_order_gateway_payment',
      {
        p_actor: 'webhook:BAC-REF',
        p_gateway_response: { status: 'success' },
        p_order_id: 'order-1',
        p_transaction_id: 'txn-1',
      }
    );
  });

  it('returns the parsed completion on success', async () => {
    const supabase = buildSupabaseMock({
      data: {
        already_completed: true,
        order_already_paid: false,
        order_cancelled: false,
        order_updated: true,
        previous_payment_status: 'pending',
      },
    });

    const result = await completeOrderGatewayPayment({
      actor: 'cron:reconcile-gateway-paid-orders',
      gatewayResponse: null,
      orderId: 'order-1',
      supabase,
      transactionId: 'txn-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.completion.already_completed).toBe(true);
      expect(result.completion.order_updated).toBe(true);
    }
  });

  it('fails closed when the RPC itself errors', async () => {
    const supabase = buildSupabaseMock({
      data: null,
      error: { message: 'permission denied' },
    });

    const result = await completeOrderGatewayPayment({
      actor: 'webhook:BAC-REF',
      gatewayResponse: null,
      orderId: 'order-1',
      supabase,
      transactionId: 'txn-1',
    });

    expect(result.ok).toBe(false);
  });

  it('fails closed when the RPC payload does not match the schema', async () => {
    const supabase = buildSupabaseMock({
      data: { order_updated: 'definitely' },
    });

    const result = await completeOrderGatewayPayment({
      actor: 'webhook:BAC-REF',
      gatewayResponse: null,
      orderId: 'order-1',
      supabase,
      transactionId: 'txn-1',
    });

    expect(result.ok).toBe(false);
  });
});
