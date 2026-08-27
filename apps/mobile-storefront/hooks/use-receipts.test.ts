import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type SupabaseMockResult = Promise<{ data: unknown; error: unknown }>;

const mockSelectCalls: Record<string, string[]> = {};
const mockOrderEq = jest.fn();
const mockOrderSingle = jest.fn<() => SupabaseMockResult>();
const mockPaymentAccountOrder = jest.fn<() => SupabaseMockResult>();
const mockTransactionsOrder = jest.fn<() => SupabaseMockResult>();

jest.mock('@/lib/api', () => ({
  withSupabaseRetry: (operation: () => Promise<unknown>) => operation(),
}));

jest.mock('@/lib/config', () => ({
  CONFIG: { MERCHANT_SLUG: 'ogabassey' },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn() }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: (query: string) => {
        mockSelectCalls[table] = [...(mockSelectCalls[table] ?? []), query];

        if (table === 'orders') {
          return {
            eq: mockOrderEq,
          };
        }

        if (table === 'order_payment_accounts') {
          return {
            eq: () => ({ order: mockPaymentAccountOrder }),
          };
        }

        return {
          eq: () => ({ order: mockTransactionsOrder }),
        };
      },
    }),
  },
}));

import { receiptDetailQueryOptions } from './use-receipts';

describe('receiptDetailQueryOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockSelectCalls)) {
      delete mockSelectCalls[key];
    }

    mockOrderSingle.mockResolvedValue({
      data: {
        amount_paid: 0,
        created_at: '2026-07-08T12:33:00.000Z',
        currency: 'NGN',
        customer_email: 'buyer@example.com',
        customer_name: 'Buyer',
        customer_phone: null,
        discount_amount: 0,
        id: 'order-1',
        is_credit_order: false,
        notes: null,
        order_items: [
          {
            condition: 'open_box',
            id: 'item-1',
            name: '13" MacBook Air M2 (2022)',
            price: 690000,
            quantity: 1,
            variant_name: '512GB',
          },
        ],
        order_number: 'ORD-1',
        payment_method: 'paystack',
        payment_status: 'pending',
        shipping_address: null,
        shipping_fee: 0,
        subtotal: 690000,
        tax_amount: 0,
        total: 690000,
      },
      error: null,
    });
    mockOrderEq.mockImplementation(() => ({
      eq: mockOrderEq,
      single: mockOrderSingle,
    }));
    mockPaymentAccountOrder.mockResolvedValue({ data: [], error: null });
    mockTransactionsOrder.mockResolvedValue({ data: [], error: null });
  });

  it('fetches and returns receipt item condition and variant metadata', async () => {
    const detail = await receiptDetailQueryOptions('order-1', {
      merchantId: 'merchant-1',
      userId: 'user-1',
    }).queryFn();

    expect(mockSelectCalls.orders?.[0]).toEqual(
      expect.stringContaining('condition')
    );
    expect(mockOrderEq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(mockOrderEq).toHaveBeenCalledWith('customers.user_id', 'user-1');
    expect(mockSelectCalls.orders?.[0]).toEqual(
      expect.stringContaining('variant_name')
    );
    expect(detail.items[0]).toEqual(
      expect.objectContaining({
        condition: 'open_box',
        product_name: '13" MacBook Air M2 (2022)',
        variant_name: '512GB',
      })
    );
  });

  it('uses the paid transaction receiver when historical aliases coexist', async () => {
    mockOrderSingle.mockResolvedValueOnce({
      data: {
        amount_paid: 1000,
        created_at: '2026-07-08T12:33:00.000Z',
        currency: 'NGN',
        customer_email: 'buyer@example.com',
        customer_name: 'Buyer',
        customer_phone: null,
        discount_amount: 0,
        id: 'order-1',
        is_credit_order: false,
        notes: null,
        order_items: [],
        order_number: 'ORD-1',
        payment_method: 'paystack',
        payment_status: 'paid',
        shipping_address: null,
        shipping_fee: 0,
        subtotal: 1000,
        tax_amount: 0,
        total: 1000,
      },
      error: null,
    });
    mockPaymentAccountOrder.mockResolvedValueOnce({
      data: [
        {
          account_name: 'Paid DVA',
          account_number: '1111111111',
          assigned_at: '2026-07-08T11:00:00.000Z',
          bank_name: 'Paystack',
          created_at: '2026-07-08T11:00:00.000Z',
          expires_at: '2026-07-08T12:30:00.000Z',
          provider: 'paystack',
        },
        {
          account_name: 'Newer DVA',
          account_number: '2222222222',
          assigned_at: '2026-07-08T12:00:00.000Z',
          bank_name: 'Paystack',
          created_at: '2026-07-08T12:00:00.000Z',
          expires_at: '2026-07-08T13:30:00.000Z',
          provider: 'paystack',
        },
      ],
      error: null,
    });
    mockTransactionsOrder.mockResolvedValueOnce({
      data: [
        {
          amount: 1000,
          created_at: '2026-07-08T12:45:00.000Z',
          description: 'Paystack DVA payment',
          gateway: 'paystack',
          metadata: { dva_account_number: '1111111111' },
          status: 'completed',
          transaction_type: 'payment',
        },
      ],
      error: null,
    });

    const detail = await receiptDetailQueryOptions('order-1', {
      merchantId: 'merchant-1',
      userId: 'user-1',
    }).queryFn();

    expect(detail.virtual_account?.account_number).toBe('1111111111');
  });

  it('requires both user and merchant scope for receipt detail queries', async () => {
    await expect(
      receiptDetailQueryOptions('order-1', {
        merchantId: null,
        userId: 'user-1',
      }).queryFn()
    ).rejects.toThrow('Authentication required to load receipt');
    await expect(
      receiptDetailQueryOptions('order-1', {
        merchantId: 'merchant-1',
        userId: null,
      }).queryFn()
    ).rejects.toThrow('Authentication required to load receipt');
  });

  it('preserves null receipt item condition and variant metadata', async () => {
    mockOrderSingle.mockResolvedValueOnce({
      data: {
        amount_paid: 0,
        created_at: '2026-07-08T12:33:00.000Z',
        currency: 'NGN',
        customer_email: 'buyer@example.com',
        customer_name: 'Buyer',
        customer_phone: null,
        discount_amount: 0,
        id: 'order-1',
        is_credit_order: false,
        notes: null,
        order_items: [
          {
            condition: null,
            id: 'item-1',
            name: '13" MacBook Air M2 (2022)',
            price: 690000,
            quantity: 1,
            variant_name: null,
          },
        ],
        order_number: 'ORD-1',
        payment_method: 'paystack',
        payment_status: 'pending',
        shipping_address: null,
        shipping_fee: 0,
        subtotal: 690000,
        tax_amount: 0,
        total: 690000,
      },
      error: null,
    });

    const detail = await receiptDetailQueryOptions('order-1', {
      merchantId: 'merchant-1',
      userId: 'user-1',
    }).queryFn();

    expect(detail.items[0]).toEqual(
      expect.objectContaining({
        condition: null,
        product_name: '13" MacBook Air M2 (2022)',
        variant_name: null,
      })
    );
  });
});
