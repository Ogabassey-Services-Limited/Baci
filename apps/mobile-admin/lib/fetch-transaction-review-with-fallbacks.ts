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
  stage:
    | 'Base'
    | 'BaseNoLineId'
    | 'BaseNoVariantId'
    | 'BaseWithDiscount'
    | 'Full'
    | 'FullNoDiscount'
    | 'LegacyNoAdjustments'
    | 'LegacyNoAdjustmentsNoDiscountCode'
    | 'Legacy',
  error: TransactionReviewQueryError
) {
  if (__DEV__ && error) {
    console.warn('[TransactionReview] select failed', { error, stage });
  }
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
  let { data, error } = await fetchTransactionReviewRows({
    endDateFilter,
    endDateIso,
    includeCancelledAt: true,
    includeTransactionDate: true,
    merchantId,
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
      merchantId,
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
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.legacy,
      startDateFilter,
      startDateIso,
    });

    data = legacyResult.data;
    error = legacyResult.error;

    warnTransactionReviewQueryError('Legacy', error);
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    const legacyNoAdjustmentsResult = await fetchTransactionReviewRows({
      endDateFilter,
      endDateIso,
      includeCancelledAt: true,
      includeTransactionDate: true,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustments,
      startDateFilter,
      startDateIso,
    });

    data = legacyNoAdjustmentsResult.data;
    error = legacyNoAdjustmentsResult.error;

    warnTransactionReviewQueryError('LegacyNoAdjustments', error);
  }

  if (isMissingDiscountCodeIdSchemaError(error)) {
    const legacyNoAdjustmentsNoDiscountCodeResult =
      await fetchTransactionReviewRows({
        endDateFilter,
        endDateIso,
        includeCancelledAt: true,
        includeTransactionDate: true,
        merchantId,
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustmentsNoDiscountCode,
        startDateFilter,
        startDateIso,
      });

    data = legacyNoAdjustmentsNoDiscountCodeResult.data;
    error = legacyNoAdjustmentsNoDiscountCodeResult.error;

    warnTransactionReviewQueryError('LegacyNoAdjustmentsNoDiscountCode', error);
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    const baseWithDiscountResult = await fetchTransactionReviewRows({
      endDateIso,
      includeCancelledAt: true,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.baseWithDiscount,
      startDateIso,
    });

    data = baseWithDiscountResult.data;
    error = baseWithDiscountResult.error;

    warnTransactionReviewQueryError('BaseWithDiscount', error);
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    const baseResult = await fetchTransactionReviewRows({
      endDateIso,
      includeCancelledAt: true,
      includeTransactionDate: false,
      merchantId,
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
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.legacyCompat,
      startDateFilter,
      startDateIso,
    });

    data = legacyCompatResult.data;
    error = legacyCompatResult.error;

    warnTransactionReviewQueryError('Legacy', error);
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    const baseWithDiscountCompatResult = await fetchTransactionReviewRows({
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.baseWithDiscountCompat,
      startDateIso,
    });

    data = baseWithDiscountCompatResult.data;
    error = baseWithDiscountCompatResult.error;

    warnTransactionReviewQueryError('BaseWithDiscount', error);
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    const baseCompatResult = await fetchTransactionReviewRows({
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
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
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.noDiscount,
      startDateIso,
    });

    data = noDiscountResult.data;
    error = noDiscountResult.error;

    warnTransactionReviewQueryError('Base', error);
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    const baseWithDiscountNoLineIdResult = await fetchTransactionReviewRows({
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoLineId,
      startDateIso,
    });

    data = baseWithDiscountNoLineIdResult.data;
    error = baseWithDiscountNoLineIdResult.error;

    warnTransactionReviewQueryError('BaseNoLineId', error);
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    const noLineIdResult = await fetchTransactionReviewRows({
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.noLineId,
      startDateIso,
    });

    data = noLineIdResult.data;
    error = noLineIdResult.error;

    warnTransactionReviewQueryError('BaseNoLineId', error);
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    const baseWithDiscountNoVariantIdResult = await fetchTransactionReviewRows({
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoVariantId,
      startDateIso,
    });

    data = baseWithDiscountNoVariantIdResult.data;
    error = baseWithDiscountNoVariantIdResult.error;

    warnTransactionReviewQueryError('BaseNoVariantId', error);
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    const noVariantIdResult = await fetchTransactionReviewRows({
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.noVariantId,
      startDateIso,
    });

    data = noVariantIdResult.data;
    error = noVariantIdResult.error;

    warnTransactionReviewQueryError('BaseNoVariantId', error);
  }

  return { data, error };
}
