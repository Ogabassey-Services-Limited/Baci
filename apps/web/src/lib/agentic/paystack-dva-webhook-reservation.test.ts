import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { confirmAgenticPaystackDvaPayment } from '@/lib/agentic/paystack-dva-webhook';

const POSTGRES_UNIQUE_VIOLATION = '23505';

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

describe('agentic Paystack DVA transaction reservation', () => {
  it('returns the created pending transaction for standard webhook processing', async () => {
    const existingTransactionChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    existingTransactionChain.eq.mockReturnValue(existingTransactionChain);
    const insertSingle = vi.fn().mockResolvedValue({
      data: pendingTransaction,
      error: null,
    });
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insertTransaction = vi.fn(() => ({ select: insertSelect }));
    const readChain = createSessionLookup([createProcessingSession()]);
    const from = vi.fn((table: string) => {
      if (table === 'checkout_sessions')
        return { select: vi.fn(() => readChain) };
      if (table === 'transactions') {
        return {
          insert: insertTransaction,
          select: vi.fn(() => existingTransactionChain),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await confirmAgenticPaystackDvaPayment({
      accountNumber: '9930000902',
      gatewayReference: 'paystack-ref-1',
      supabase: { from } as unknown as SupabaseClient,
      verifiedAmount: { amount: 500000, currency: 'NGN' },
    });

    expect(result).toEqual({
      handled: false,
      transaction: normalizedPendingTransaction,
    });
    expect(insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway: 'paystack',
        gateway_reference: 'paystack-ref-1',
        merchant_id: 'merchant-1',
        order_id: 'order-1',
        status: 'pending',
        transaction_type: 'payment',
      })
    );
  });

  it('returns the reserved transaction when the database unique guard wins', async () => {
    const existingTransactionChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    existingTransactionChain.eq.mockReturnValue(existingTransactionChain);
    const reservedTransactionChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: pendingTransaction,
        error: null,
      }),
    };
    reservedTransactionChain.eq.mockReturnValue(reservedTransactionChain);
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: POSTGRES_UNIQUE_VIOLATION,
        message: 'duplicate key value',
      },
    });
    const insertTransaction = vi.fn(() => ({
      select: vi.fn(() => ({ single: insertSingle })),
    }));
    const readChain = createSessionLookup([createProcessingSession()]);
    const transactionSelect = vi
      .fn()
      .mockReturnValueOnce(existingTransactionChain)
      .mockReturnValueOnce(reservedTransactionChain);
    const from = vi.fn((table: string) => {
      if (table === 'checkout_sessions')
        return { select: vi.fn(() => readChain) };
      if (table === 'transactions') {
        return {
          insert: insertTransaction,
          select: transactionSelect,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await confirmAgenticPaystackDvaPayment({
      accountNumber: '9930000902',
      gatewayReference: 'paystack-ref-1',
      supabase: { from } as unknown as SupabaseClient,
      verifiedAmount: { amount: 500000, currency: 'NGN' },
    });

    expect(result).toEqual({
      handled: false,
      transaction: normalizedPendingTransaction,
    });
    expect(insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway: 'paystack',
        gateway_reference: 'paystack-ref-1',
        merchant_id: 'merchant-1',
        order_id: 'order-1',
        status: 'pending',
        transaction_type: 'payment',
      })
    );
  });
});
