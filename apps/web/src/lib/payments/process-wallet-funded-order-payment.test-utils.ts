import { vi } from 'vitest';

export const intent = {
  createdAt: '2026-05-26T12:00:00.000Z',
  currency: 'NGN',
  customerId: 'customer-1',
  debitedAmount: 0,
  excessAmount: 0,
  expectedAmount: 20_000,
  expiresAt: '2026-05-26T12:30:00.000Z',
  fundedAmount: 0,
  id: 'intent-1',
  idempotencyKey: 'key-1',
  lastGatewayReference: null,
  lastTransactionId: null,
  merchantId: 'merchant-1',
  orderId: 'order-1',
  provider: 'paystack' as const,
  status: 'pending' as const,
  targetOrderAmount: 20_000,
  walletBalanceSnapshot: 0,
  walletPaymentAccountId: 'wallet-account-1',
};

export const transaction = {
  amount: 20_000,
  id: 'txn-funding-1',
  merchant_id: 'merchant-1',
  metadata: {
    customer_id: 'customer-1',
    transaction_type: 'wallet_topup',
    wallet_payment_account_id: 'wallet-account-1',
  },
};

export function createWalletFundedOrderPaymentSupabase({
  orderCancellationState = {
    cancelled_at: null,
    id: 'order-1',
    shipping_status: 'processing',
  },
  orderTransactionData = {
    amount: 20_000,
    gateway_reference: 'WALLET-DVA-ORDER-order-1',
    id: 'txn-order-1',
    merchant_id: 'merchant-1',
    order_id: 'order-1',
    platform_fee: 0,
  },
  orderTransactionError = null,
  orderTransactionResponses,
}: {
  orderCancellationState?: Record<string, unknown> | null;
  orderTransactionData?: Record<string, unknown> | null;
  orderTransactionError?: unknown;
  orderTransactionResponses?: Array<{
    data: Record<string, unknown> | null;
    error?: unknown;
  }>;
} = {}) {
  const richOrderQuery = {
    eq: vi.fn(() => richOrderQuery),
    // fetchOrderCancellationState uses maybeSingle; fetchPaidOrder uses single.
    maybeSingle: vi.fn(async () => ({
      data: orderCancellationState,
      error: null,
    })),
    single: vi.fn(async () => ({
      data: {
        customer_email: 'jane@example.com',
        customer_id: 'customer-1',
        customer_name: 'Jane Doe',
        discount_amount: 0,
        gift_wrapping_fee: 0,
        id: 'order-1',
        merchant_id: 'merchant-1',
        order_items: [],
        payment_status: 'paid',
        shipping_fee: 0,
        subtotal: 20_000,
        tax_amount: 0,
        tax_basis: 'exclusive',
        total: 20_000,
      },
      error: null,
    })),
    select: vi.fn().mockReturnThis(),
  };
  const orderTransactionResponseQueue = orderTransactionResponses
    ? [...orderTransactionResponses]
    : null;
  const orderTransactionSingle = vi.fn(() => {
    const queuedResponse = orderTransactionResponseQueue?.shift();
    if (queuedResponse) {
      return {
        data: queuedResponse.data,
        error: queuedResponse.error ?? null,
      };
    }
    return {
      data: orderTransactionData,
      error: orderTransactionError,
    };
  });
  const orderTransactionQuery = {
    eq: vi.fn(() => orderTransactionQuery),
    maybeSingle: orderTransactionSingle,
    select: vi.fn().mockReturnThis(),
    single: orderTransactionSingle,
  };
  const paymentRows = [
    {
      amount: 20_000,
      created_at: '2026-05-26T12:05:00.000Z',
      gateway_fee: 300,
      id: 'intent-payment-1',
      paid_at: '2026-05-26T12:05:00.000Z',
    },
  ];
  const paymentRowsOrderedQuery = {
    order: vi.fn(async () => ({ data: paymentRows, error: null })),
  };
  const paymentRowsFilteredQuery = {
    order: vi.fn(() => paymentRowsOrderedQuery),
  };
  const paymentsQuery = {
    eq: vi.fn(() => paymentRowsFilteredQuery),
    select: vi.fn(() => paymentsQuery),
  };
  const reviewQuery = {
    insert: vi.fn(async () => ({ data: null, error: null })),
  };

  return {
    orderTransactionSingle,
    from: vi.fn((table: string) => {
      if (table === 'orders') return richOrderQuery;
      if (table === 'transactions') return orderTransactionQuery;
      if (table === 'order_wallet_funding_intent_payments')
        return paymentsQuery;
      if (table === 'reconciliation_review') return reviewQuery;
      throw new Error(`unexpected table ${table}`);
    }),
    rpc: vi.fn(async () => ({
      data: {
        credited_amount: 20_000,
        debited_amount: 20_000,
        excess_amount: 0,
        funded_amount: 20_000,
        order_id: 'order-1',
        order_paid: true,
        order_payment_transaction_id: 'txn-order-1',
        wallet_credit_transaction_id: 'wallet-credit-1',
        wallet_debit_transaction_id: 'wallet-debit-1',
      },
      error: null,
    })),
  };
}
