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
  | 'BaseNoQuizAwardId'
  | 'BaseNoVariantId'
  | 'BaseWithDiscount'
  | 'Full'
  | 'FullNoDiscount'
  | 'LegacyNoDiscountCode'
  | 'LegacyNoProductMatchStatus'
  | 'LegacyNoVariantAttributes'
  | 'LegacyNoVariantAttributesNoLaterFields'
  | 'LegacyNoAdjustments'
  | 'LegacyNoAdjustmentsNoDiscountCode'
  | 'Legacy';

function getTransactionReviewErrorText(error: TransactionReviewQueryError) {
  return [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isMissingSchemaColumn(
  error: TransactionReviewQueryError,
  column: string
) {
  return (
    getTransactionReviewErrorText(error).includes(column) &&
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

function runLegacyTransactionReviewQuery(
  stage: TransactionReviewFallbackStage,
  query: TransactionReviewFallbackQuery,
  selectStatement: string,
  includeCancelledAt: boolean
) {
  return runTransactionReviewQuery(stage, {
    ...query,
    includeCancelledAt,
    includeTransactionDate: true,
    selectStatement,
  });
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
  const legacyQuery = {
    endDateFilter,
    endDateIso,
    merchantId,
    startDateFilter,
    startDateIso,
  };
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

  if (isMissingSchemaColumn(error, 'discount_amount')) {
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

  if (isMissingSchemaColumn(error, 'variant_attributes')) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'LegacyNoVariantAttributes',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributes,
      true
    ));

    if (
      isMissingSchemaColumn(error, 'discount_code_id') ||
      isMissingSchemaColumn(error, 'order_item_unit_costs')
    ) {
      ({ data, error } = await runLegacyTransactionReviewQuery(
        'LegacyNoVariantAttributesNoLaterFields',
        legacyQuery,
        TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributesNoLaterFields,
        true
      ));
    }
  }

  if (isMissingSchemaColumn(error, 'product_match_status')) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'LegacyNoProductMatchStatus',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacyNoProductMatchStatus,
      true
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'Legacy',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacy,
      true
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'LegacyNoAdjustments',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustments,
      true
    ));
  }
  if (isMissingSchemaColumn(error, 'discount_code_id')) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'LegacyNoDiscountCode',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacyNoDiscountCode,
      true
    ));

    if (isTransactionReviewSchemaCacheError(error)) {
      ({ data, error } = await runLegacyTransactionReviewQuery(
        'LegacyNoAdjustmentsNoDiscountCode',
        legacyQuery,
        TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustmentsNoDiscountCode,
        true
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
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'Legacy',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacyCompat,
      false
    ));
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

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runTransactionReviewQuery('BaseNoQuizAwardId', {
      endDateIso,
      includeCancelledAt: false,
      includeTransactionDate: false,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.noVariantIdNoQuizAwardId,
      startDateIso,
    }));
  }

  return { data, error };
}
