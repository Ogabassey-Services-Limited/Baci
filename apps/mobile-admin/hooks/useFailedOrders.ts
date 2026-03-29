import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';

export interface FailedOrder {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total: number;
  payment_status: 'bnpl_pending' | 'failed' | 'pending' | 'expired';
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

export function useFailedOrders() {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useQuery({
    queryKey: ['failed-orders', merchantId],
    queryFn: async () => {
      const staleCutoff = new Date(
        Date.now() - STALE_PENDING_MINUTES * 60 * 1000
      ).toISOString();

      // Fetch orders that need merchant follow-up:
      // - failed: payment attempt failed (card declined, etc.)
      // - bnpl_pending: BNPL started but not completed
      // - expired: DVA/payment link expired without payment
      // - pending older than 30min: likely abandoned bank transfer
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
          transactions (
            gateway_response,
            status,
            gateway
          )
        `)
        .eq('merchant_id', merchantId)
        .or(
          `payment_status.in.(bnpl_pending,failed,expired),and(payment_status.eq.pending,created_at.lt.${staleCutoff})`
        )
        .order('created_at', { ascending: false });

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
