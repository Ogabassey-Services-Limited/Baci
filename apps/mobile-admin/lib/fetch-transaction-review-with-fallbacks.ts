import {
  fetchRichTransactionReviewRows,
  isMissingSchemaColumn,
  runBaseTransactionReviewQuery,
  runLegacyTransactionReviewQuery,
  type TransactionReviewFallbackQuery,
} from './fetch-transaction-review-rich-fallback';
import { isTransactionReviewSchemaCacheError } from './is-transaction-review-schema-cache-error';
import { TRANSACTION_REVIEW_SELECTORS } from './transaction-review-selectors';

/**
 * Reads transaction-review rows through selectors that tolerate schema-cache
 * drift while preserving the richest available discount and cost fields.
 */
export async function fetchTransactionReviewWithFallbacks(
  query: TransactionReviewFallbackQuery
) {
  const legacyQuery = query;
  let { data, error } = await fetchRichTransactionReviewRows(query);

  if (isMissingSchemaColumn(error, 'line_id')) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'FullNoLineId',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.fullNoLineId,
      true,
      {
        selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoLineIdNoTaxAmount,
        stage: 'FullNoLineIdNoTaxAmount',
      }
    ));
  }

  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseTransactionReviewQuery(
      'BaseWithDiscount',
      legacyQuery,
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
    ({ data, error } = await runBaseTransactionReviewQuery(
      'Base',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.base,
      true
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'Legacy',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacyCompat,
      false,
      {
        selectStatement: TRANSACTION_REVIEW_SELECTORS.legacyCompatNoTaxAmount,
        stage: 'LegacyCompatNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseTransactionReviewQuery(
      'BaseWithDiscount',
      legacyQuery,
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
    ({ data, error } = await runBaseTransactionReviewQuery(
      'Base',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.baseCompat,
      false
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseTransactionReviewQuery(
      'Base',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.noDiscount,
      false
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseTransactionReviewQuery(
      'BaseNoLineId',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoLineId,
      false,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoLineIdNoTaxAmount,
        stage: 'BaseNoLineIdNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseTransactionReviewQuery(
      'BaseNoLineId',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.noLineId,
      false
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseTransactionReviewQuery(
      'BaseNoVariantId',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoVariantId,
      false,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoVariantIdNoTaxAmount,
        stage: 'BaseNoVariantIdNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseTransactionReviewQuery(
      'BaseNoVariantId',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.noVariantId,
      false
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runBaseTransactionReviewQuery(
      'BaseNoQuizAwardId',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.noVariantIdNoQuizAwardId,
      false
    ));
  }

  return { data, error };
}
