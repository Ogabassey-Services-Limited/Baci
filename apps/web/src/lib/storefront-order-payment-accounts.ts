import {
  getPaystackDvaAccountNumberFromTransactions,
  type OrderPaymentAccountLike,
  selectPreferredOrderPaymentAccount,
} from '@baci/shared';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

interface StorefrontOrderPaymentAccountOrder {
  id: string;
  payment_status?: string | null;
  order_payment_accounts?: readonly OrderPaymentAccountLike[] | null;
}

interface StorefrontOrderTransaction {
  order_id: string;
  metadata: unknown;
  gateway?: string | null;
  status?: string | null;
  transaction_type?: string | null;
}

/**
 * Resolve receipt accounts for a customer order list in one transaction
 * lookup, preserving the receiver recorded by a successful Paystack payment.
 */
export async function resolveStorefrontOrderPaymentAccounts(
  supabase: SupabaseClient,
  orders: readonly StorefrontOrderPaymentAccountOrder[],
  now = new Date()
) {
  const paidOrderIds = orders
    .filter((order) => order.payment_status?.trim().toLowerCase() === 'paid')
    .map((order) => order.id);
  const transactionsResult =
    paidOrderIds.length > 0
      ? await supabase
          .from('transactions')
          .select(
            'order_id, created_at, metadata, gateway, status, transaction_type'
          )
          .in('order_id', paidOrderIds)
          .order('created_at', { ascending: true })
      : { data: [], error: null as PostgrestError | null };

  const transactionsByOrderId = new Map<string, StorefrontOrderTransaction[]>();
  for (const transaction of transactionsResult.data ?? []) {
    const orderTransactions =
      transactionsByOrderId.get(transaction.order_id) ?? [];
    orderTransactions.push(transaction as StorefrontOrderTransaction);
    transactionsByOrderId.set(transaction.order_id, orderTransactions);
  }

  const paymentAccountsByOrderId = new Map<
    string,
    OrderPaymentAccountLike | null
  >();
  for (const order of orders) {
    const isPaid = order.payment_status?.trim().toLowerCase() === 'paid';
    const account = selectPreferredOrderPaymentAccount(
      order.order_payment_accounts,
      now,
      {
        allowExpiredPaystackAccount: isPaid,
        preferredPaystackAccountNumber: isPaid
          ? getPaystackDvaAccountNumberFromTransactions(
              transactionsByOrderId.get(order.id)
            )
          : null,
      }
    );
    paymentAccountsByOrderId.set(order.id, account);
  }

  return {
    paymentAccountsByOrderId,
    transactionError: transactionsResult.error,
  };
}
