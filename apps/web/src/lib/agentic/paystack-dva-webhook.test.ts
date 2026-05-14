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
    in: vi.fn().mockResolvedValue({ data, error }),
    or: vi.fn(),
  };
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

  it('rejects payments that differ by one minor currency unit', async () => {
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
      verifiedAmount: { amount: 499999, currency: 'NGN' },
    });

    expect(result).toEqual({
      body: { error: 'Payment amount mismatch' },
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
