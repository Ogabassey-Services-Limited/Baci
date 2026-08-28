import { fetchRichTransactionReviewRows } from './fetch-transaction-review-rich-fallback';
import { isMissingSchemaColumn } from './is-missing-transaction-review-schema-column';
import { isTransactionReviewSchemaCacheError } from './is-transaction-review-schema-cache-error';
import { runBaseTransactionReviewQuery } from './run-base-transaction-review-query';
import { runLegacyTransactionReviewQuery } from './run-legacy-transaction-review-query';
import {
  omitUnavailableTransactionReviewSchemaColumns,
  type TransactionReviewSchemaColumnAvailability,
} from './transaction-review-fallback-schema-columns';
import type {
  TaxAmountFallback,
  TransactionReviewFallbackQuery,
} from './transaction-review-fallback-types';
import { TRANSACTION_REVIEW_SELECTORS } from './transaction-review-selectors';

/**
 * Reads transaction-review rows through selectors that tolerate schema-cache
 * drift while preserving the richest available discount and cost fields.
 */
export async function fetchTransactionReviewWithFallbacks(
  query: TransactionReviewFallbackQuery
) {
  const legacyQuery = query;
  let quizAwardIdUnavailable = false;
  let discountAmountUnavailable = false;
  let discountCodeUnavailable = false;
  let adTrackingUnavailable = false;
  let cancelledAtUnavailable = false;
  let transactionDateUnavailable = false;
  let variantIdUnavailable = false;
  const markMissingSchemaColumn = (column: string) => {
    if (column === 'quiz_award_id') {
      quizAwardIdUnavailable = true;
    }
    if (column === 'discount_code_id') {
      discountCodeUnavailable = true;
    }
    if (column === 'discount_amount') {
      discountAmountUnavailable = true;
    }
    if (column === 'ad_tracking') {
      adTrackingUnavailable = true;
    }
    if (column === 'cancelled_at') {
      cancelledAtUnavailable = true;
    }
    if (column === 'transaction_date') {
      transactionDateUnavailable = true;
    }
    if (column === 'variant_id') {
      variantIdUnavailable = true;
    }
  };
  const getSchemaColumnAvailability =
    (): TransactionReviewSchemaColumnAvailability => ({
      adTrackingUnavailable,
      cancelledAtUnavailable,
      discountAmountUnavailable,
      discountCodeUnavailable,
      quizAwardIdUnavailable,
      transactionDateUnavailable,
      variantIdUnavailable,
    });
  const omitUnavailableSchemaColumns = (selector: string) => {
    return omitUnavailableTransactionReviewSchemaColumns(
      selector,
      getSchemaColumnAvailability()
    );
  };
  type TransactionReviewFallbackResult = Awaited<
    ReturnType<typeof runLegacyTransactionReviewQuery>
  >;
  const runWithUnavailableSchemaColumns = async (
    runQuery: () => Promise<TransactionReviewFallbackResult>
  ) => {
    let result = await runQuery();
    while (true) {
      let shouldRetry = false;
      if (
        !quizAwardIdUnavailable &&
        isMissingSchemaColumn(result.error, 'quiz_award_id')
      ) {
        quizAwardIdUnavailable = true;
        shouldRetry = true;
      }
      if (
        !discountCodeUnavailable &&
        isMissingSchemaColumn(result.error, 'discount_code_id')
      ) {
        discountCodeUnavailable = true;
        shouldRetry = true;
      }
      if (
        !discountAmountUnavailable &&
        isMissingSchemaColumn(result.error, 'discount_amount')
      ) {
        discountAmountUnavailable = true;
        shouldRetry = true;
      }
      if (
        !adTrackingUnavailable &&
        isMissingSchemaColumn(result.error, 'ad_tracking')
      ) {
        adTrackingUnavailable = true;
        shouldRetry = true;
      }
      if (
        !cancelledAtUnavailable &&
        isMissingSchemaColumn(result.error, 'cancelled_at')
      ) {
        cancelledAtUnavailable = true;
        shouldRetry = true;
      }
      if (
        !transactionDateUnavailable &&
        isMissingSchemaColumn(result.error, 'transaction_date')
      ) {
        transactionDateUnavailable = true;
        shouldRetry = true;
      }
      if (
        !variantIdUnavailable &&
        isMissingSchemaColumn(result.error, 'variant_id')
      ) {
        variantIdUnavailable = true;
        shouldRetry = true;
      }
      if (!shouldRetry) {
        return result;
      }
      result = await runQuery();
    }
  };
  const runLegacyFallbackQuery = (
    stage: string,
    selectStatement: string,
    includeCancelledAt: boolean,
    taxAmountFallback?: TaxAmountFallback
  ) => {
    const runQuery = () =>
      runLegacyTransactionReviewQuery(
        stage,
        legacyQuery,
        omitUnavailableSchemaColumns(selectStatement),
        includeCancelledAt && !cancelledAtUnavailable,
        taxAmountFallback
          ? {
              ...taxAmountFallback,
              selectStatement: omitUnavailableSchemaColumns(
                taxAmountFallback.selectStatement
              ),
            }
          : undefined,
        !transactionDateUnavailable
      );

    return runWithUnavailableSchemaColumns(runQuery);
  };
  const runBaseFallbackQuery = (
    stage: string,
    selectStatement: string,
    includeCancelledAt: boolean,
    taxAmountFallback?: TaxAmountFallback
  ) => {
    const runQuery = () =>
      runBaseTransactionReviewQuery(
        stage,
        legacyQuery,
        omitUnavailableSchemaColumns(selectStatement),
        includeCancelledAt && !cancelledAtUnavailable,
        taxAmountFallback
          ? {
              ...taxAmountFallback,
              selectStatement: omitUnavailableSchemaColumns(
                taxAmountFallback.selectStatement
              ),
            }
          : undefined
      );

    return runWithUnavailableSchemaColumns(runQuery);
  };
  let { data, error } = await fetchRichTransactionReviewRows(query, {
    onMissingSchemaColumn: markMissingSchemaColumn,
  });
  if (isMissingSchemaColumn(error, 'line_id')) {
    ({ data, error } = await runLegacyFallbackQuery(
      'FullNoLineId',
      TRANSACTION_REVIEW_SELECTORS.fullNoLineId,
      true,
      {
        selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoLineIdNoTaxAmount,
        stage: 'FullNoLineIdNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseFallbackQuery(
      'BaseWithDiscount',
      TRANSACTION_REVIEW_SELECTORS.baseWithDiscount,
      true,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoTaxAmount,
        stage: 'BaseWithDiscountNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseFallbackQuery(
      'Base',
      TRANSACTION_REVIEW_SELECTORS.base,
      true
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runLegacyFallbackQuery(
      'Legacy',
      TRANSACTION_REVIEW_SELECTORS.legacyCompat,
      false,
      {
        selectStatement: TRANSACTION_REVIEW_SELECTORS.legacyCompatNoTaxAmount,
        stage: 'LegacyCompatNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseFallbackQuery(
      'BaseWithDiscount',
      TRANSACTION_REVIEW_SELECTORS.baseWithDiscountCompat,
      false,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.baseWithDiscountCompatNoTaxAmount,
        stage: 'BaseWithDiscountCompatNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseFallbackQuery(
      'Base',
      TRANSACTION_REVIEW_SELECTORS.baseCompat,
      false
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseFallbackQuery(
      'Base',
      TRANSACTION_REVIEW_SELECTORS.noDiscount,
      false
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseFallbackQuery(
      'BaseNoLineId',
      TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoLineId,
      true,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoLineIdNoTaxAmount,
        stage: 'BaseNoLineIdNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseFallbackQuery(
      'BaseNoLineId',
      TRANSACTION_REVIEW_SELECTORS.noLineId,
      false
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseFallbackQuery(
      'BaseNoVariantId',
      TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoVariantId,
      true,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoVariantIdNoTaxAmount,
        stage: 'BaseNoVariantIdNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseFallbackQuery(
      'BaseNoVariantId',
      TRANSACTION_REVIEW_SELECTORS.noVariantId,
      false
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseFallbackQuery(
      'BaseNoQuizAwardId',
      TRANSACTION_REVIEW_SELECTORS.noVariantIdNoQuizAwardId,
      false
    ));
  }

  return { data, error };
}
