import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { resolveStorefrontOrderPaymentAccounts } from './storefront-order-payment-accounts';

function createQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn().mockResolvedValue(result),
  };
  return query;
}

const accounts = [
  {
    account_name: 'Paid DVA',
    account_number: '1111111111',
    bank_name: 'Paystack',
    created_at: '2026-07-08T11:00:00.000Z',
    expires_at: '2026-07-08T12:30:00.000Z',
    provider: 'paystack',
  },
  {
    account_name: 'Newer DVA',
    account_number: '2222222222',
    bank_name: 'Paystack',
    created_at: '2026-07-08T12:00:00.000Z',
    expires_at: '2026-07-08T13:30:00.000Z',
    provider: 'paystack',
  },
];

describe('resolveStorefrontOrderPaymentAccounts', () => {
  it('uses the paid transaction receiver for a historical alias', async () => {
    const transactionQuery = createQuery({
      data: [
        {
          created_at: '2026-07-08T12:45:00.000Z',
          gateway: 'paystack',
          metadata: { dva_account_number: '1111111111' },
          order_id: 'order-1',
          status: 'completed',
          transaction_type: 'payment',
        },
      ],
      error: null,
    });
    const supabase = {
      from: vi.fn(() => transactionQuery),
    } as unknown as SupabaseClient;

    const result = await resolveStorefrontOrderPaymentAccounts(
      supabase,
      [
        {
          id: 'order-1',
          order_payment_accounts: accounts,
          payment_status: 'paid',
        },
      ],
      new Date('2026-07-08T13:00:00.000Z')
    );

    expect(result.paymentAccountsByOrderId.get('order-1')?.account_number).toBe(
      '1111111111'
    );
    expect(transactionQuery.in).toHaveBeenCalledWith('order_id', ['order-1']);
  });

  it('returns transaction lookup errors while preserving account resolution', async () => {
    const error = new Error('transaction lookup unavailable');
    const transactionQuery = createQuery({ data: null, error });
    const supabase = {
      from: vi.fn(() => transactionQuery),
    } as unknown as SupabaseClient;

    const result = await resolveStorefrontOrderPaymentAccounts(
      supabase,
      [
        {
          id: 'order-1',
          order_payment_accounts: accounts,
          payment_status: 'paid',
        },
      ],
      new Date('2026-07-08T13:00:00.000Z')
    );

    expect(result.transactionError).toBe(error);
    expect(result.paymentAccountsByOrderId.get('order-1')?.account_number).toBe(
      '2222222222'
    );
  });
});
