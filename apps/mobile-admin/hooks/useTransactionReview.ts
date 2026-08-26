import { useQuery } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { fetchTransactionReviewRows } from '@/lib/fetch-transaction-review-rows';
import { filterExcludedTransactionReviewRows } from '@/lib/filter-excluded-transaction-review-rows';
import { isTransactionReviewSchemaCacheError } from '@/lib/is-transaction-review-schema-cache-error';
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
  'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, discount_code_id, source, ad_tracking, fulfillment_details, order_items(id, product_id, variant_id, product_match_status, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, order_item_unit_costs(unit_index, cost_price, supplier_name, identifier_type, identifier_value), product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))';

const TRANSACTION_REVIEW_FULL_NO_DISCOUNT_SELECT =
  'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_code_id, source, ad_tracking, fulfillment_details, order_items(id, product_id, variant_id, product_match_status, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, order_item_unit_costs(unit_index, cost_price, supplier_name, identifier_type, identifier_value), product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))';

export const TRANSACTION_REVIEW_LEGACY_SELECT =
  'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, discount_code_id, source, ad_tracking, fulfillment_details, order_items(id, product_id, variant_id, product_match_status, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))';

const TRANSACTION_REVIEW_LEGACY_COMPAT_SELECT =
  'id, order_number, created_at, transaction_date, shipping_status, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, discount_code_id, source, ad_tracking, fulfillment_details, order_items(id, product_id, variant_id, product_match_status, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))';

const TRANSACTION_REVIEW_BASE_SELECT =
  'id, order_number, created_at, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, fulfillment_details, order_items(id, product_id, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))';

const TRANSACTION_REVIEW_BASE_COMPAT_SELECT =
  'id, order_number, created_at, shipping_status, customer_name, customer_email, customer_phone, payment_method, total, fulfillment_details, order_items(id, product_id, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))';

// Keep a final selector for deployments whose schema cache predates the
// persisted order discount column. The mapper treats the omitted value as 0.
const TRANSACTION_REVIEW_NO_DISCOUNT_SELECT =
  'id, order_number, created_at, shipping_status, customer_name, customer_email, customer_phone, payment_method, total, fulfillment_details, order_items(id, product_id, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))';

function isMissingDiscountAmountSchemaError(
  error: {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  } | null
) {
  const errorText = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    errorText.includes('discount_amount') &&
    isTransactionReviewSchemaCacheError(error)
  );
}

function warnTransactionReviewQueryError(
  stage: 'Base' | 'Full' | 'FullNoDiscount' | 'Legacy',
  error: {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  } | null
) {
  if (__DEV__ && error) {
    console.warn('[TransactionReview] select failed', { error, stage });
  }
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
        includeCancelledAt: true,
        includeTransactionDate: true,
        merchantId: merchant.id,
        selectStatement: TRANSACTION_REVIEW_FULL_SELECT,
        startDateFilter,
        startDateIso,
      });

      warnTransactionReviewQueryError('Full', error);

      if (isMissingDiscountAmountSchemaError(error)) {
        const noDiscountResult = await fetchTransactionReviewRows({
          endDateFilter,
          endDateIso,
          includeCancelledAt: true,
          includeTransactionDate: true,
          merchantId: merchant.id,
          selectStatement: TRANSACTION_REVIEW_FULL_NO_DISCOUNT_SELECT,
          startDateFilter,
          startDateIso,
        });

        data = noDiscountResult.data;
        error = noDiscountResult.error;

        warnTransactionReviewQueryError('FullNoDiscount', error);
      }

      if (isTransactionReviewSchemaCacheError(error)) {
        const legacyResult = await fetchTransactionReviewRows({
          endDateFilter,
          endDateIso,
          includeCancelledAt: true,
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
          includeCancelledAt: true,
          includeTransactionDate: false,
          merchantId: merchant.id,
          selectStatement: TRANSACTION_REVIEW_BASE_SELECT,
          startDateIso,
        });

        data = baseResult.data;
        error = baseResult.error;

        warnTransactionReviewQueryError('Base', error);
      }

      if (isTransactionReviewSchemaCacheError(error)) {
        const legacyCompatResult = await fetchTransactionReviewRows({
          endDateFilter,
          endDateIso,
          includeCancelledAt: false,
          includeTransactionDate: true,
          merchantId: merchant.id,
          selectStatement: TRANSACTION_REVIEW_LEGACY_COMPAT_SELECT,
          startDateFilter,
          startDateIso,
        });

        data = legacyCompatResult.data;
        error = legacyCompatResult.error;

        warnTransactionReviewQueryError('Legacy', error);
      }

      if (isTransactionReviewSchemaCacheError(error)) {
        const baseCompatResult = await fetchTransactionReviewRows({
          endDateIso,
          includeCancelledAt: false,
          includeTransactionDate: false,
          merchantId: merchant.id,
          selectStatement: TRANSACTION_REVIEW_BASE_COMPAT_SELECT,
          startDateIso,
        });

        data = baseCompatResult.data;
        error = baseCompatResult.error;

        warnTransactionReviewQueryError('Base', error);
      }

      if (isTransactionReviewSchemaCacheError(error)) {
        const noDiscountResult = await fetchTransactionReviewRows({
          endDateIso,
          includeCancelledAt: false,
          includeTransactionDate: false,
          merchantId: merchant.id,
          selectStatement: TRANSACTION_REVIEW_NO_DISCOUNT_SELECT,
          startDateIso,
        });

        data = noDiscountResult.data;
        error = noDiscountResult.error;

        warnTransactionReviewQueryError('Base', error);
      }

      if (error) {
        throw new Error(error.message);
      }

      return mapTransactionOrderRows(
        filterExcludedTransactionReviewRows(
          (data ?? []) as unknown as TransactionReviewOrderRow[]
        )
      );
    },
    enabled: Boolean(merchant?.id),
    staleTime: 1000 * 60,
  });
}
