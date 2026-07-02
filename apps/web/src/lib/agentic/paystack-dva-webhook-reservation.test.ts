import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { confirmAgenticPaystackDvaPayment } from '@/lib/agentic/paystack-dva-webhook';

const pendingAgenticMetadata = {
  agentic: {
    dva_account: { account_number: '9930000902' },
    payment_state: 'payment_pending',
  },
};

const pendingTransaction = {
  amount: '500000',
  currency: 'NGN',
  gateway_reference: null,
  id: 'txn-1',
  merchant_id: 'merchant-1',
  metadata: {
    agentic_checkout_session_id: 'agentic_session_1',
    agentic_virtual_account_number: '9930000902',
    transaction_type: 'agentic_checkout_payment',
  },
  order_id: 'order-1',
  platform_fee: null,
};

const normalizedPendingTransaction = {
  ...pendingTransaction,
  amount: 500000,
};

function createSessionLookup(data: unknown) {
  const chain = {
    in: vi.fn().mockResolvedValue({ data, error: null }),
    or: vi.fn(),
  };
  chain.or.mockReturnValue(chain);
  return chain;
}

function createProcessingSession() {
  return {
    currency: 'NGN',
    id: 'checkout-row-1',
    merchant_id: 'merchant-1',
    metadata: pendingAgenticMetadata,
    order_id: 'order-1',
    session_id: 'agentic_session_1',
    status: 'processing',
    total_amount: 500000,
  };
}

function createTransactionLookup(data: unknown) {
  const chain = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  chain.eq.mockReturnValue(chain);
  return chain;
}

describe('agentic Paystack DVA transaction reservation', () => {
  it('returns the created pending transaction for standard webhook processing', async () => {
    const existingTransactionChain = createTransactionLookup(null);
    const reservedTransactionChain =
      createTransactionLookup(pendingTransaction);
    const orderLookupChain = createTransactionLookup({
      customer_email: 'buyer@example.com',
      customer_name: 'Buyer Example',
    });
    const readChain = createSessionLookup([createProcessingSession()]);
    const reserveTransaction = vi.fn().mockResolvedValue({
      data: 'txn-1',
      error: null,
    });
    const transactionSelect = vi
      .fn()
      .mockReturnValueOnce(existingTransactionChain)
      .mockReturnValueOnce(reservedTransactionChain);
    const from = vi.fn((table: string) => {
      if (table === 'checkout_sessions')
        return { select: vi.fn(() => readChain) };
      if (table === 'orders') return { select: vi.fn(() => orderLookupChain) };
      if (table === 'transactions') {
        return {
          select: transactionSelect,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await confirmAgenticPaystackDvaPayment({
      accountNumber: '9930000902',
      gatewayReference: 'paystack-ref-1',
      supabase: { from, rpc: reserveTransaction } as unknown as SupabaseClient,
      verifiedAmount: { amount: 500000, currency: 'NGN' },
    });

    expect(result).toEqual({
      handled: false,
      transaction: normalizedPendingTransaction,
    });
    expect(reserveTransaction).toHaveBeenCalledWith(
      'create_payment_transaction',
      expect.objectContaining({
        p_customer_email: 'buyer@example.com',
        p_gateway: 'paystack',
        p_merchant_id: 'merchant-1',
        p_order_id: 'order-1',
        p_reference: 'paystack-ref-1',
      })
    );
  });

  it('returns the reserved transaction when the locked RPC returns an existing id', async () => {
    const existingTransactionChain = createTransactionLookup(null);
    const reservedTransactionChain =
      createTransactionLookup(pendingTransaction);
    const orderLookupChain = createTransactionLookup({
      customer_email: 'buyer@example.com',
      customer_name: 'Buyer Example',
    });
    const readChain = createSessionLookup([createProcessingSession()]);
    const reserveTransaction = vi.fn().mockResolvedValue({
      data: 'txn-1',
      error: null,
    });
    const transactionSelect = vi
      .fn()
      .mockReturnValueOnce(existingTransactionChain)
      .mockReturnValueOnce(reservedTransactionChain);
    const from = vi.fn((table: string) => {
      if (table === 'checkout_sessions')
        return { select: vi.fn(() => readChain) };
      if (table === 'orders') return { select: vi.fn(() => orderLookupChain) };
      if (table === 'transactions') {
        return {
          select: transactionSelect,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await confirmAgenticPaystackDvaPayment({
      accountNumber: '9930000902',
      gatewayReference: 'paystack-ref-1',
      supabase: { from, rpc: reserveTransaction } as unknown as SupabaseClient,
      verifiedAmount: { amount: 500000, currency: 'NGN' },
    });

    expect(result).toEqual({
      handled: false,
      transaction: normalizedPendingTransaction,
    });
    expect(reserveTransaction).toHaveBeenCalledWith(
      'create_payment_transaction',
      expect.objectContaining({
        p_gateway: 'paystack',
        p_merchant_id: 'merchant-1',
        p_order_id: 'order-1',
        p_reference: 'paystack-ref-1',
      })
    );
  });
});
