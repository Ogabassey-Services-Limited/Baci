import { fetchTransactionReviewRows } from './fetch-transaction-review-rows';
import { isTransactionReviewSchemaCacheError } from './is-transaction-review-schema-cache-error';
import { TRANSACTION_REVIEW_SELECTORS } from './transaction-review-selectors';

interface TransactionReviewFallbackQuery {
  endDateFilter?: string;
  endDateIso?: string;
  merchantId: string;
  startDateFilter?: string;
  startDateIso?: string;
}

type TransactionReviewQueryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
} | null;

type TransactionReviewFallbackStage =
  | 'Base'
  | 'BaseNoLineId'
  | 'BaseNoVariantId'
  | 'BaseWithDiscount'
  | 'Full'
  | 'FullNoDiscount'
  | 'LegacyNoDiscountCode'
  | 'LegacyNoAdjustments'
  | 'LegacyNoAdjustmentsNoDiscountCode'
  | 'Legacy';

function isMissingDiscountAmountSchemaError(
  error: TransactionReviewQueryError
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

function isMissingDiscountCodeIdSchemaError(
  error: TransactionReviewQueryError
) {
  const errorText = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    errorText.includes('discount_code_id') &&
    isTransactionReviewSchemaCacheError(error)
  );
}

function warnTransactionReviewQueryError(
  stage: TransactionReviewFallbackStage,
  error: TransactionReviewQueryError
) {
  if (__DEV__ && error) {
    console.warn('[TransactionReview] select failed', { error, stage });
  }
}

type TransactionReviewQueryOptions = Parameters<
  typeof fetchTransactionReviewRows
>[0];

async function runTransactionReviewQuery(
  stage: TransactionReviewFallbackStage,
  options: TransactionReviewQueryOptions
) {
  const result = await fetchTransactionReviewRows(options);
  warnTransactionReviewQueryError(stage, result.error);
  return result;
}

/**
 * Reads transaction-review rows through selectors that tolerate schema-cache
 * drift while preserving the richest available discount and cost fields.
 */
export async function fetchTransactionReviewWithFallbacks({
  endDateFilter,
  endDateIso,
  merchantId,
  startDateFilter,
  startDateIso,
}: TransactionReviewFallbackQuery) {
  let { data, error } = await runTransactionReviewQuery('Full', {
    endDateFilter,
    endDateIso,
    includeCancelledAt: true,
    includeTransactionDate: true,
    merchantId,
    selectStatement: TRANSACTION_REVIEW_SELECTORS.full,
    startDateFilter,
    startDateIso,
  });

  if (isMissingDiscountAmountSchemaError(error)) {
    ({ data, error } = await runTransactionReviewQuery('FullNoDiscount', {
      endDateFilter,
      endDateIso,
      includeCancelledAt: true,
      includeTransactionDate: true,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoDiscount,
      startDateFilter,
      startDateIso,
    }));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('Legacy', {
      endDateFilter,
      endDateIso,
      includeCancelledAt: true,
      includeTransactionDate: true,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.legacy,
      startDateFilter,
      startDateIso,
    }));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('LegacyNoAdjustments', {
      endDateFilter,
      endDateIso,
      includeCancelledAt: true,
      includeTransactionDate: true,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustments,
      startDateFilter,
      startDateIso,
    }));
  }

  if (isMissingDiscountCodeIdSchemaError(error)) {
    ({ data, error } = await runTransactionReviewQuery('LegacyNoDiscountCode', {
      endDateFilter,
      endDateIso,
      includeCancelledAt: true,
      includeTransactionDate: true,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.legacyNoDiscountCode,
      startDateFilter,
      startDateIso,
    }));

    if (isTransactionReviewSchemaCacheError(error)) {
      ({ data, error } = await runTransactionReviewQuery(
        'LegacyNoAdjustmentsNoDiscountCode',
        {
          endDateFilter,
          endDateIso,
          includeCancelledAt: true,
          includeTransactionDate: true,
          merchantId,
          selectStatement:
            TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustmentsNoDiscountCode,
          startDateFilter,
          startDateIso,
        }
      ));
    }
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('BaseWithDiscount', {
      endDateIso,
      includeCancelledAt: true,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.baseWithDiscount,
      startDateIso,
    }));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('Base', {
      endDateIso,
      includeCancelledAt: true,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.base,
      startDateIso,
    }));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('Legacy', {
      endDateFilter,
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: true,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.legacyCompat,
      startDateFilter,
      startDateIso,
    }));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('BaseWithDiscount', {
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.baseWithDiscountCompat,
      startDateIso,
    }));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('Base', {
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.baseCompat,
      startDateIso,
    }));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('Base', {
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.noDiscount,
      startDateIso,
    }));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('BaseNoLineId', {
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoLineId,
      startDateIso,
    }));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('BaseNoLineId', {
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.noLineId,
      startDateIso,
    }));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('BaseNoVariantId', {
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoVariantId,
      startDateIso,
    }));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('BaseNoVariantId', {
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.noVariantId,
      startDateIso,
    }));
  }

  return { data, error };
}
