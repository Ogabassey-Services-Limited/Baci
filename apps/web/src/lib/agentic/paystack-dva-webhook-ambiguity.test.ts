import { describe, expect, it, vi } from 'vitest';
import { confirmAgenticPaystackDvaPayment } from '@/lib/agentic/paystack-dva-webhook';

const metadata = {
  agentic: {
    dva_account: { account_number: '9930000902' },
    payment_state: 'payment_pending',
  },
};

describe('agentic Paystack DVA webhook ambiguity handling', () => {
  it('fails closed when one DVA account maps to multiple active sessions', async () => {
    const existingTransactionChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    existingTransactionChain.eq.mockReturnValue(existingTransactionChain);
    const readChain = {
      in: vi.fn().mockResolvedValue({
        data: [
          {
            currency: 'NGN',
            merchant_id: 'merchant-1',
            metadata,
            order_id: 'order-1',
            session_id: 'agentic_session_1',
            status: 'processing',
            total_amount: 500000,
          },
          {
            currency: 'NGN',
            merchant_id: 'merchant-1',
            metadata,
            order_id: 'order-2',
            session_id: 'agentic_session_2',
            status: 'processing',
            total_amount: 500000,
          },
        ],
        error: null,
      }),
      or: vi.fn(),
    };
    readChain.or.mockReturnValue(readChain);
    const insertTransaction = vi.fn();
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

    expect(result).toEqual({
      body: { error: 'Ambiguous agentic checkout payment account' },
      handled: true,
      status: 409,
    });
    expect(insertTransaction).not.toHaveBeenCalled();
  });
});
