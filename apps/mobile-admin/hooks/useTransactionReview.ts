import { useQuery } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import {
  buildTransactionReviewRangeFilters,
  mapTransactionOrderRows,
  type TransactionReviewItem,
  type TransactionReviewOrder,
  type TransactionReviewOrderRow,
} from '@/lib/transaction-review';

interface TransactionReviewRange {
  endDate?: Date;
  startDate?: Date;
}

export type { TransactionReviewItem, TransactionReviewOrder };

export function useTransactionReview(range?: TransactionReviewRange) {
  const { merchant } = useMerchant();
  const startDateIso = range?.startDate
    ? new Date(
        Date.UTC(
          range.startDate.getUTCFullYear(),
          range.startDate.getUTCMonth(),
          range.startDate.getUTCDate(),
          0,
          0,
          0,
          0
        )
      ).toISOString()
    : undefined;
  const endDateIso = range?.endDate
    ? new Date(
        Date.UTC(
          range.endDate.getUTCFullYear(),
          range.endDate.getUTCMonth(),
          range.endDate.getUTCDate(),
          23,
          59,
          59,
          999
        )
      ).toISOString()
    : undefined;
  const { endDateFilter, startDateFilter } = buildTransactionReviewRangeFilters(
    startDateIso,
    endDateIso
  );

  return useQuery<TransactionReviewOrder[]>({
    queryKey: ['transaction-review', merchant?.id, startDateIso, endDateIso],
    queryFn: async () => {
      if (!merchant?.id) {
        throw new Error('Merchant context is not ready');
      }

      let query = supabase
        .from('orders')
        .select(
          'id, order_number, created_at, transaction_date, customer_name, customer_email, customer_phone, payment_method, total, fulfillment_details, order_items(id, product_id, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))'
        )
        .eq('merchant_id', merchant.id)
        .eq('payment_status', 'paid')
        .order('transaction_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (startDateFilter) {
        query = query.or(startDateFilter);
      }

      if (endDateFilter) {
        query = query.or(endDateFilter);
      }

      const { data, error } = await query.limit(40);

      if (error) {
        throw new Error(error.message);
      }

      return mapTransactionOrderRows(
        (data ?? []) as TransactionReviewOrderRow[]
      );
    },
    enabled: Boolean(merchant?.id),
    staleTime: 1000 * 60,
  });
}
