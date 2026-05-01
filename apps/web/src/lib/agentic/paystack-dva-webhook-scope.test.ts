import { describe, expect, it, vi } from 'vitest';
import { confirmAgenticPaystackDvaPayment } from '@/lib/agentic/paystack-dva-webhook';

describe('agentic Paystack DVA webhook scoping', () => {
  it('falls through when a matching DVA account belongs to non-agentic metadata', async () => {
    const existingTransactionChain = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    existingTransactionChain.eq.mockReturnValue(existingTransactionChain);
    const readChain = {
      in: vi.fn(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            currency: 'NGN',
            merchant_id: 'merchant-1',
            metadata: { source: 'storefront_checkout' },
            order_id: 'order-1',
            session_id: 'storefront-session-1',
            status: 'processing',
            total_amount: 500000,
          },
        ],
        error: null,
      }),
      or: vi.fn(),
    };
    readChain.in.mockReturnValue(readChain);
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

    expect(result).toEqual({ handled: false });
    expect(insertTransaction).not.toHaveBeenCalled();
  });
});
