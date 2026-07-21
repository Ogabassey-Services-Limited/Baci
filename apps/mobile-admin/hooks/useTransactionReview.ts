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

const TRANSACTION_REVIEW_FULL_SELECT =
  'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, fulfillment_details, order_items(id, product_id, variant_id, product_match_status, name, price, quantity, cost_price, supplier_name, fulfillment_data, order_item_unit_costs(unit_index, cost_price, supplier_name, identifier_type, identifier_value), product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))';

export const TRANSACTION_REVIEW_LEGACY_SELECT =
  'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, fulfillment_details, order_items(id, product_id, variant_id, product_match_status, name, price, quantity, cost_price, supplier_name, fulfillment_data, product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))';

const TRANSACTION_REVIEW_BASE_SELECT =
  'id, order_number, created_at, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, fulfillment_details, order_items(id, product_id, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))';

interface SupabaseQueryError {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
}

export function isTransactionReviewSchemaCacheError(
  error: SupabaseQueryError | null
) {
  const errorText = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const isMissingSchemaShape =
    errorText.includes('schema cache') || error?.code === '42703';
  const mentionsTransactionReviewShape =
    errorText.includes('order_items') ||
    errorText.includes('order_item_unit_costs') ||
    errorText.includes('orders') ||
    errorText.includes('product_match_status') ||
    errorText.includes('supplier_name') ||
    errorText.includes('unit_index') ||
    errorText.includes('identifier_type') ||
    errorText.includes('identifier_value') ||
    errorText.includes('transaction_date') ||
    errorText.includes('cost_price') ||
    errorText.includes('product_variants') ||
    errorText.includes('variant_id');

  return isMissingSchemaShape && mentionsTransactionReviewShape;
}

function warnTransactionReviewQueryError(
  stage: 'Base' | 'Full' | 'Legacy',
  error: SupabaseQueryError | null
) {
  if (__DEV__ && error) {
    console.warn('[TransactionReview] select failed', { error, stage });
  }
}

export function fetchTransactionReviewRows({
  endDateFilter,
  endDateIso,
  includeTransactionDate,
  merchantId,
  selectStatement,
  startDateFilter,
  startDateIso,
}: {
  endDateFilter?: string;
  endDateIso?: string;
  includeTransactionDate: boolean;
  merchantId: string;
  selectStatement: string;
  startDateFilter?: string;
  startDateIso?: string;
}) {
  let query = supabase
    .from('orders')
    .select(selectStatement)
    .eq('merchant_id', merchantId)
    .eq('payment_status', 'paid')
    .is('cancelled_at', null)
    .or('shipping_status.is.null,shipping_status.not.in.(cancelled,canceled)');

  if (includeTransactionDate) {
    query = query.order('transaction_date', {
      ascending: false,
      nullsFirst: false,
    });
  }

  query = query.order('created_at', { ascending: false });

  if (includeTransactionDate && startDateFilter) {
    query = query.or(startDateFilter);
  } else if (!includeTransactionDate && startDateIso) {
    query = query.gte('created_at', startDateIso);
  }

  if (includeTransactionDate && endDateFilter) {
    query = query.or(endDateFilter);
  } else if (!includeTransactionDate && endDateIso) {
    query = query.lte('created_at', endDateIso);
  }

  return query.limit(40);
}

export function filterCancelledTransactionReviewRows<
  T extends {
    cancelled_at?: string | null;
    shipping_status?: string | null;
  },
>(rows: T[]) {
  return rows.filter(
    (row) =>
      row.cancelled_at == null &&
      row.shipping_status !== 'cancelled' &&
      row.shipping_status !== 'canceled'
  );
}

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

      let { data, error } = await fetchTransactionReviewRows({
        endDateFilter,
        endDateIso,
        includeTransactionDate: true,
        merchantId: merchant.id,
        selectStatement: TRANSACTION_REVIEW_FULL_SELECT,
        startDateFilter,
        startDateIso,
      });

      warnTransactionReviewQueryError('Full', error);

      if (isTransactionReviewSchemaCacheError(error)) {
        const legacyResult = await fetchTransactionReviewRows({
          endDateFilter,
          endDateIso,
          includeTransactionDate: true,
          merchantId: merchant.id,
          selectStatement: TRANSACTION_REVIEW_LEGACY_SELECT,
          startDateFilter,
          startDateIso,
        });

        data = legacyResult.data;
        error = legacyResult.error;

        warnTransactionReviewQueryError('Legacy', error);
      }

      if (isTransactionReviewSchemaCacheError(error)) {
        const baseResult = await fetchTransactionReviewRows({
          endDateIso,
          includeTransactionDate: false,
          merchantId: merchant.id,
          selectStatement: TRANSACTION_REVIEW_BASE_SELECT,
          startDateIso,
        });

        data = baseResult.data;
        error = baseResult.error;

        warnTransactionReviewQueryError('Base', error);
      }

      if (error) {
        throw new Error(error.message);
      }

      return mapTransactionOrderRows(
        filterCancelledTransactionReviewRows(
          (data ?? []) as unknown as TransactionReviewOrderRow[]
        )
      );
    },
    enabled: Boolean(merchant?.id),
    staleTime: 1000 * 60,
  });
}
