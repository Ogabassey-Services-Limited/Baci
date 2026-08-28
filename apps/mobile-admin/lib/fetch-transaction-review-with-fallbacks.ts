import {
  fetchRichTransactionReviewRows,
  isMissingSchemaColumn,
  runBaseTransactionReviewQuery,
  runLegacyTransactionReviewQuery,
  type TransactionReviewFallbackQuery,
} from './fetch-transaction-review-rich-fallback';
import { isTransactionReviewSchemaCacheError } from './is-transaction-review-schema-cache-error';
import { TRANSACTION_REVIEW_SELECTORS } from './transaction-review-selectors';

type TaxAmountFallback = Readonly<{
  selectStatement: string;
  stage: string;
}>;

function withoutQuizAwardId(selector: string) {
  return selector.replace(', quiz_award_id', '');
}

function withoutDiscountCode(selector: string) {
  return selector.replace(', discount_code_id', '');
}

/**
 * Reads transaction-review rows through selectors that tolerate schema-cache
 * drift while preserving the richest available discount and cost fields.
 */
export async function fetchTransactionReviewWithFallbacks(
  query: TransactionReviewFallbackQuery
) {
  const legacyQuery = query;
  let quizAwardIdUnavailable = false;
  let discountCodeUnavailable = false;
  const markMissingSchemaColumn = (column: string) => {
    if (column === 'quiz_award_id') {
      quizAwardIdUnavailable = true;
    }
    if (column === 'discount_code_id') {
      discountCodeUnavailable = true;
    }
  };
  const omitUnavailableSchemaColumns = (selector: string) => {
    const withoutQuiz = quizAwardIdUnavailable
      ? withoutQuizAwardId(selector)
      : selector;
    return discountCodeUnavailable
      ? withoutDiscountCode(withoutQuiz)
      : withoutQuiz;
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
        includeCancelledAt,
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
        includeCancelledAt,
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
