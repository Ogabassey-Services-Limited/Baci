import { describe, expect, it, vi } from 'vitest';
import {
  confirmAgenticPaystackDvaPayment,
  getPaystackDvaReceiverAccountNumber,
} from '@/lib/agentic/paystack-dva-webhook';

const pendingAgenticMetadata = {
  agentic: {
    dva_account: { account_number: '9930000902' },
    payment_state: 'payment_pending',
  },
};

function createSessionLookup(data: unknown, error: unknown = null) {
  const chain = {
    in: vi.fn(),
    limit: vi.fn().mockResolvedValue({ data, error }),
    or: vi.fn(),
  };
  chain.in.mockReturnValue(chain);
  chain.or.mockReturnValue(chain);
  return chain;
}

describe('agentic Paystack DVA webhook handling', () => {
  it('extracts the receiver account from Paystack dedicated NUBAN payloads', () => {
    expect(
      getPaystackDvaReceiverAccountNumber({
        data: {
          authorization: {
            receiver_bank_account_number: '9930000902',
          },
        },
      })
    ).toBe('9930000902');
  });

  it('creates a pending transaction and falls through to standard webhook processing', async () => {
    const sessions = [
      {
        currency: 'NGN',
        id: 'checkout-row-1',
        merchant_id: 'merchant-1',
        metadata: pendingAgenticMetadata,
        order_id: 'order-1',
        session_id: 'agentic_session_1',
        status: 'processing',
        total_amount: 500000,
      },
    ];
    const existingTransactionChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    existingTransactionChain.eq.mockReturnValue(existingTransactionChain);
    const insertTransaction = vi.fn().mockResolvedValue({ error: null });

    const readChain = createSessionLookup(sessions);

    const from = vi.fn((table: string) => {
      if (table === 'checkout_sessions') {
        return {
          select: vi.fn(() => readChain),
        };
      }
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
      supabase: { from } as never,
      verifiedAmount: { amount: 500000, currency: 'NGN' },
    });

    expect(result).toEqual({ handled: false });
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
    expect(insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          agentic_checkout_session_id: 'agentic_session_1',
          agentic_virtual_account_number: '9930000902',
          transaction_type: 'agentic_checkout_payment',
        }),
      })
    );
    expect(from).toHaveBeenCalledWith('transactions');
    expect(from).toHaveBeenCalledWith('checkout_sessions');
  });

  it('falls through when the database unique guard already reserved the reference', async () => {
    const existingTransactionChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    existingTransactionChain.eq.mockReturnValue(existingTransactionChain);
    const readChain = createSessionLookup([
      {
        currency: 'NGN',
        merchant_id: 'merchant-1',
        metadata: pendingAgenticMetadata,
        order_id: 'order-1',
        session_id: 'agentic_session_1',
        status: 'processing',
        total_amount: 500000,
      },
    ]);
    const insertTransaction = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value' },
    });
    const from = vi.fn((table: string) =>
      table === 'transactions'
        ? {
            insert: insertTransaction,
            select: vi.fn(() => existingTransactionChain),
          }
        : { select: vi.fn(() => readChain) }
    );

    const result = await confirmAgenticPaystackDvaPayment({
      accountNumber: '9930000902',
      gatewayReference: 'paystack-ref-1',
      supabase: { from } as never,
      verifiedAmount: { amount: 500000, currency: 'NGN' },
    });

    expect(result).toEqual({ handled: false });
    expect(insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ gateway_reference: 'paystack-ref-1' })
    );
  });

  it('fails closed when Paystack amount verification is unavailable', async () => {
    const insertTransaction = vi.fn().mockResolvedValue({ error: null });
    const existingTransactionChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    existingTransactionChain.eq.mockReturnValue(existingTransactionChain);
    const readChain = createSessionLookup([
      {
        currency: 'NGN',
        id: 'checkout-row-1',
        merchant_id: 'merchant-1',
        metadata: pendingAgenticMetadata,
        order_id: 'order-1',
        session_id: 'agentic_session_1',
        status: 'processing',
        total_amount: 500000,
      },
    ]);
    const from = vi.fn((table: string) => {
      if (table === 'checkout_sessions') {
        return { select: vi.fn(() => readChain) };
      }
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
      supabase: { from } as never,
      verifiedAmount: null,
    });

    expect(result).toEqual({
      body: { error: 'Payment amount verification unavailable' },
      handled: true,
      status: 400,
    });
    expect(insertTransaction).not.toHaveBeenCalled();
  });

  it('acknowledges completed sessions without creating a new transaction', async () => {
    const insertTransaction = vi.fn().mockResolvedValue({ error: null });
    const existingTransactionChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    existingTransactionChain.eq.mockReturnValue(existingTransactionChain);
    const readChain = createSessionLookup([
      {
        currency: 'NGN',
        id: 'checkout-row-1',
        merchant_id: 'merchant-1',
        metadata: pendingAgenticMetadata,
        order_id: 'order-1',
        session_id: 'agentic_session_1',
        status: 'completed',
        total_amount: 500000,
      },
    ]);
    const from = vi.fn((table: string) => {
      if (table === 'checkout_sessions') {
        return { select: vi.fn(() => readChain) };
      }
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
      supabase: { from } as never,
      verifiedAmount: { amount: 500000, currency: 'NGN' },
    });

    expect(result).toEqual({
      body: { message: 'Agentic checkout payment already processed' },
      handled: true,
      status: 200,
    });
    expect(insertTransaction).not.toHaveBeenCalled();
  });
});
