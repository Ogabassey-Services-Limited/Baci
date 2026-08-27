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
import { TRANSACTION_REVIEW_SELECTORS } from '@/lib/transaction-review-selectors';

interface TransactionReviewRange {
  endDate?: Date;
  startDate?: Date;
}

export type { TransactionReviewItem, TransactionReviewOrder };

export const TRANSACTION_REVIEW_LEGACY_SELECT =
  TRANSACTION_REVIEW_SELECTORS.legacy;

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
  stage:
    | 'Base'
    | 'BaseNoLineId'
    | 'BaseWithDiscount'
    | 'Full'
    | 'FullNoDiscount'
    | 'Legacy',
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
        selectStatement: TRANSACTION_REVIEW_SELECTORS.full,
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
          selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoDiscount,
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
          selectStatement: TRANSACTION_REVIEW_SELECTORS.legacy,
          startDateFilter,
          startDateIso,
        });

        data = legacyResult.data;
        error = legacyResult.error;

        warnTransactionReviewQueryError('Legacy', error);
      }

      if (isTransactionReviewSchemaCacheError(error)) {
        const baseWithDiscountResult = await fetchTransactionReviewRows({
          endDateIso,
          includeCancelledAt: true,
          includeTransactionDate: false,
          merchantId: merchant.id,
          selectStatement: TRANSACTION_REVIEW_SELECTORS.baseWithDiscount,
          startDateIso,
        });

        data = baseWithDiscountResult.data;
        error = baseWithDiscountResult.error;

        warnTransactionReviewQueryError('BaseWithDiscount', error);
      }

      if (isTransactionReviewSchemaCacheError(error)) {
        const baseWithDiscountCompatResult = await fetchTransactionReviewRows({
          endDateIso,
          includeCancelledAt: false,
          includeTransactionDate: false,
          merchantId: merchant.id,
          selectStatement: TRANSACTION_REVIEW_SELECTORS.baseWithDiscountCompat,
          startDateIso,
        });

        data = baseWithDiscountCompatResult.data;
        error = baseWithDiscountCompatResult.error;

        warnTransactionReviewQueryError('BaseWithDiscount', error);
      }

      if (isTransactionReviewSchemaCacheError(error)) {
        const baseResult = await fetchTransactionReviewRows({
          endDateIso,
          includeCancelledAt: true,
          includeTransactionDate: false,
          merchantId: merchant.id,
          selectStatement: TRANSACTION_REVIEW_SELECTORS.base,
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
          selectStatement: TRANSACTION_REVIEW_SELECTORS.legacyCompat,
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
          selectStatement: TRANSACTION_REVIEW_SELECTORS.baseCompat,
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
          selectStatement: TRANSACTION_REVIEW_SELECTORS.noDiscount,
          startDateIso,
        });

        data = noDiscountResult.data;
        error = noDiscountResult.error;

        warnTransactionReviewQueryError('Base', error);
      }

      if (isTransactionReviewSchemaCacheError(error)) {
        const baseWithDiscountNoLineIdResult = await fetchTransactionReviewRows(
          {
            endDateIso,
            includeCancelledAt: false,
            includeTransactionDate: false,
            merchantId: merchant.id,
            selectStatement:
              TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoLineId,
            startDateIso,
          }
        );

        data = baseWithDiscountNoLineIdResult.data;
        error = baseWithDiscountNoLineIdResult.error;

        warnTransactionReviewQueryError('BaseNoLineId', error);
      }

      if (isTransactionReviewSchemaCacheError(error)) {
        const noLineIdResult = await fetchTransactionReviewRows({
          endDateIso,
          includeCancelledAt: false,
          includeTransactionDate: false,
          merchantId: merchant.id,
          selectStatement: TRANSACTION_REVIEW_SELECTORS.noLineId,
          startDateIso,
        });

        data = noLineIdResult.data;
        error = noLineIdResult.error;

        warnTransactionReviewQueryError('BaseNoLineId', error);
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
