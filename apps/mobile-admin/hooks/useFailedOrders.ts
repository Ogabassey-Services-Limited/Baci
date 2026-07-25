import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ONLINE_CHECKOUT_PAYMENT_METHODS } from './orders/order-list-visibility';
import { useMerchant } from './useMerchant';

export interface FailedOrder {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total: number;
  payment_status: 'bnpl_pending' | 'failed' | 'pending' | 'expired' | 'unpaid';
  payment_method: string;
  created_at: string;
  gateway_response?: Record<string, unknown> | null;
  gateway?: string;
  attempt_count: number;
}

type FailedOrderPaymentStatus = FailedOrder['payment_status'];

const VALID_PAYMENT_STATUSES: ReadonlySet<FailedOrderPaymentStatus> = new Set([
  'bnpl_pending',
  'failed',
  'pending',
  'expired',
  'unpaid',
]);

const toPaymentStatus = (status: string): FailedOrderPaymentStatus => {
  return VALID_PAYMENT_STATUSES.has(status as FailedOrderPaymentStatus)
    ? (status as FailedOrderPaymentStatus)
    : 'failed';
};

/** Shape returned by the Supabase select on orders with joined transactions */
interface FailedOrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total: number;
  payment_status: string;
  payment_method: string;
  created_at: string;
  transactions: {
    gateway_response: Record<string, unknown> | null;
    status: string;
    gateway: string;
  }[];
}

/** Stale threshold: pending orders older than this are likely abandoned */
const STALE_PENDING_MINUTES = 30;

/**
 * Upper age bound on the follow-up queue.
 *
 * The queue had a minimum age but no maximum and no row cap, so it grew
 * without bound — an order abandoned months ago is not an actionable
 * follow-up, and every one of them was refetched on each open.
 *
 * Aged by `created_at`, not by the latest payment attempt. Checkout can
 * resume an existing order, so a new attempt can land on an old order — but
 * across all ogabassey history the largest order->latest-attempt gap is
 * 48.3 days (16 orders exceed 1 day, 5 exceed 7, none exceed 90), so this
 * window clears the observed maximum with ~1.9x headroom. Widening it stays
 * the mitigation if that ever changes; filtering on the embedded
 * transactions relation would need an `!inner` join that drops the many
 * follow-up orders having no attempt row at all.
 *
 * Tune here: at 90 days ogabassey keeps 135 of 145 open follow-ups.
 */
export const FOLLOW_UP_WINDOW_DAYS = 90;

/**
 * Hard ceiling on rows fetched, independent of the window.
 *
 * PostgREST applies this before the client-side consolidation by email, so
 * the cap is on orders, not customers. That degrades safely: rows arrive
 * `created_at DESC`, so truncation always drops the least recently active
 * customers first and can only under-count `attempt_count` on those kept —
 * it can never rank a stale customer above a fresh one. Consolidating
 * server-side would need an aggregate/paginated endpoint; revisit if a
 * merchant ever exceeds this within the window (ogabassey is at 145).
 */
export const FOLLOW_UP_QUERY_LIMIT = 250;

/**
 * `orders` and `transactions` are joined by two foreign keys:
 * - `transactions_order_id_fkey`      transactions.order_id -> orders.id (the payment attempts)
 * - `orders_paid_transaction_id_fkey` orders.paid_transaction_id -> transactions.id (the settling attempt)
 *
 * PostgREST refuses an ambiguous embed (PGRST201) and fails the whole request,
 * so the attempt-history relationship must be named explicitly.
 */
const FAILED_ORDER_TRANSACTIONS_RELATIONSHIP =
  'transactions!transactions_order_id_fkey';

export function useFailedOrders() {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useQuery({
    queryKey: ['failed-orders', merchantId],
    queryFn: async () => {
      const staleCutoff = new Date(
        Date.now() - STALE_PENDING_MINUTES * 60 * 1000
      ).toISOString();
      const windowStart = new Date(
        Date.now() - FOLLOW_UP_WINDOW_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      // Fetch orders that need merchant follow-up, within the last
      // FOLLOW_UP_WINDOW_DAYS:
      // - failed: payment attempt failed (card declined, etc.)
      // - bnpl_pending: BNPL started but not completed
      // - expired: DVA/payment link expired without payment
      // - pending/unpaid online checkout older than 30min: likely abandoned online checkout
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_id,
          customer_name,
          customer_email,
          customer_phone,
          total,
          payment_status,
          payment_method,
          created_at,
          ${FAILED_ORDER_TRANSACTIONS_RELATIONSHIP} (
            gateway_response,
            status,
            gateway
          )
        `)
        .eq('merchant_id', merchantId)
        .gte('created_at', windowStart)
        .or(
          `payment_status.in.(bnpl_pending,failed,expired),and(payment_status.eq.pending,created_at.lt.${staleCutoff},payment_method.in.${ONLINE_CHECKOUT_PAYMENT_METHODS}),and(payment_status.eq.unpaid,created_at.lt.${staleCutoff},payment_method.in.${ONLINE_CHECKOUT_PAYMENT_METHODS})`
        )
        .order('created_at', { ascending: false })
        .limit(FOLLOW_UP_QUERY_LIMIT);

      if (error) throw error;

      // Consolidate failed orders by customer email
      const consolidated: Record<
        string,
        FailedOrder & { attempt_count: number }
      > = {};

      (data as FailedOrderRow[]).forEach((order) => {
        const email = order.customer_email;
        if (!consolidated[email]) {
          consolidated[email] = {
            id: order.id,
            order_number: order.order_number,
            customer_id: order.customer_id,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            total: order.total,
            payment_status: toPaymentStatus(order.payment_status),
            payment_method: order.payment_method,
            created_at: order.created_at,
            gateway_response: order.transactions?.[0]?.gateway_response,
            gateway: order.transactions?.[0]?.gateway,
            attempt_count: 1,
          };
        } else {
          // Track attempt count but keep most recent order's total (data is already ordered DESC)
          consolidated[email].attempt_count += 1;
        }
      });

      return Object.values(consolidated);
    },
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false,
  });
}
