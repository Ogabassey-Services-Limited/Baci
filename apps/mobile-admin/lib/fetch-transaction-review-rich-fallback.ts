import { fetchFullTransactionReviewRows } from './fetch-transaction-review-full-fallback';
import { fetchTransactionReviewRows } from './fetch-transaction-review-rows';
import { isTransactionReviewSchemaCacheError } from './is-transaction-review-schema-cache-error';
import { TRANSACTION_REVIEW_SELECTORS } from './transaction-review-selectors';

export interface TransactionReviewFallbackQuery {
  endDateFilter?: string;
  endDateIso?: string;
  merchantId: string;
  startDateFilter?: string;
  startDateIso?: string;
}

export type TransactionReviewQueryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
} | null;

type TransactionReviewFallbackStage = string;

type TransactionReviewFallbackCallbacks = Readonly<{
  onMissingSchemaColumn?: (column: string) => void;
}>;

function getTransactionReviewErrorText(error: TransactionReviewQueryError) {
  return [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function isMissingSchemaColumn(
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

type TaxAmountFallback = Readonly<{
  selectStatement: string;
  stage: TransactionReviewFallbackStage;
}>;

function withoutQuizAwardId(selector: string) {
  return selector.replace(', quiz_award_id', '');
}

async function runTransactionReviewQuery(
  stage: TransactionReviewFallbackStage,
  options: TransactionReviewQueryOptions
) {
  const result = await fetchTransactionReviewRows(options);
  warnTransactionReviewQueryError(stage, result.error);
  return result;
}

async function runTransactionReviewQueryWithTaxFallback(
  stage: TransactionReviewFallbackStage,
  options: TransactionReviewQueryOptions,
  taxAmountFallback: TaxAmountFallback
) {
  let result = await runTransactionReviewQuery(stage, options);
  if (isMissingSchemaColumn(result.error, 'tax_amount')) {
    result = await runTransactionReviewQuery(taxAmountFallback.stage, {
      ...options,
      selectStatement: taxAmountFallback.selectStatement,
    });
  }
  return result;
}

export function runLegacyTransactionReviewQuery(
  stage: TransactionReviewFallbackStage,
  query: TransactionReviewFallbackQuery,
  selectStatement: string,
  includeCancelledAt: boolean,
  taxAmountFallback?: TaxAmountFallback
) {
  const options = {
    ...query,
    includeCancelledAt,
    includeTransactionDate: true,
    selectStatement,
  };
  return taxAmountFallback
    ? runTransactionReviewQueryWithTaxFallback(
        stage,
        options,
        taxAmountFallback
      )
    : runTransactionReviewQuery(stage, options);
}

export function runBaseTransactionReviewQuery(
  stage: TransactionReviewFallbackStage,
  query: TransactionReviewFallbackQuery,
  selectStatement: string,
  includeCancelledAt: boolean,
  taxAmountFallback?: TaxAmountFallback
) {
  const options = {
    endDateIso: query.endDateIso,
    includeCancelledAt,
    includeTransactionDate: false,
    merchantId: query.merchantId,
    selectStatement,
    startDateIso: query.startDateIso,
  };
  return taxAmountFallback
    ? runTransactionReviewQueryWithTaxFallback(
        stage,
        options,
        taxAmountFallback
      )
    : runTransactionReviewQuery(stage, options);
}

/** Reads cost-rich transaction rows before compatibility/base fallbacks. */
export async function fetchRichTransactionReviewRows(
  {
    endDateFilter,
    endDateIso,
    merchantId,
    startDateFilter,
    startDateIso,
  }: TransactionReviewFallbackQuery,
  { onMissingSchemaColumn }: TransactionReviewFallbackCallbacks = {}
) {
  const legacyQuery = {
    endDateFilter,
    endDateIso,
    merchantId,
    startDateFilter,
    startDateIso,
  };
  let quizAwardIdUnavailable = false;
  let { data, error } = await fetchFullTransactionReviewRows(
    {
      endDateFilter,
      endDateIso,
      merchantId,
      startDateFilter,
      startDateIso,
    },
    {
      isMissingSchemaColumn,
      onMissingSchemaColumn: (column) => {
        if (column === 'quiz_award_id') {
          quizAwardIdUnavailable = true;
        }
        onMissingSchemaColumn?.(column);
      },
      runQueryWithTaxFallback: runTransactionReviewQueryWithTaxFallback,
    }
  );

  const runLegacyFallbackQuery = async (
    stage: TransactionReviewFallbackStage,
    selectStatement: string,
    taxAmountFallback?: TaxAmountFallback
  ) => {
    const omitUnavailableQuizAwardId = (selector: string) =>
      quizAwardIdUnavailable ? withoutQuizAwardId(selector) : selector;

    const runQuery = () =>
      runLegacyTransactionReviewQuery(
        stage,
        legacyQuery,
        omitUnavailableQuizAwardId(selectStatement),
        true,
        taxAmountFallback
          ? {
              ...taxAmountFallback,
              selectStatement: omitUnavailableQuizAwardId(
                taxAmountFallback.selectStatement
              ),
            }
          : undefined
      );

    let result = await runQuery();
    if (
      !quizAwardIdUnavailable &&
      isMissingSchemaColumn(result.error, 'quiz_award_id')
    ) {
      quizAwardIdUnavailable = true;
      onMissingSchemaColumn?.('quiz_award_id');
      result = await runQuery();
    }

    if (isMissingSchemaColumn(result.error, 'quiz_award_id')) {
      quizAwardIdUnavailable = true;
      onMissingSchemaColumn?.('quiz_award_id');
    }
    return result;
  };

  if (isMissingSchemaColumn(error, 'variant_attributes')) {
    ({ data, error } = await runLegacyFallbackQuery(
      'LegacyNoVariantAttributes',
      TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributes,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributesNoTaxAmount,
        stage: 'LegacyNoVariantAttributesNoTaxAmount',
      }
    ));

    if (
      isMissingSchemaColumn(error, 'discount_code_id') ||
      isMissingSchemaColumn(error, 'order_item_unit_costs')
    ) {
      ({ data, error } = await runLegacyFallbackQuery(
        'LegacyNoVariantAttributesNoLaterFields',
        TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributesNoLaterFields,
        {
          selectStatement:
            TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributesNoLaterFieldsNoTaxAmount,
          stage: 'LegacyNoVariantAttributesNoLaterFieldsNoTaxAmount',
        }
      ));
    }
  }

  if (isMissingSchemaColumn(error, 'product_match_status')) {
    ({ data, error } = await runLegacyFallbackQuery(
      'LegacyNoProductMatchStatus',
      TRANSACTION_REVIEW_SELECTORS.legacyNoProductMatchStatus,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.legacyNoProductMatchStatusNoTaxAmount,
        stage: 'LegacyNoProductMatchStatusNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runLegacyFallbackQuery(
      'Legacy',
      TRANSACTION_REVIEW_SELECTORS.legacy,
      {
        selectStatement: TRANSACTION_REVIEW_SELECTORS.legacyNoTaxAmount,
        stage: 'LegacyNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runLegacyFallbackQuery(
      'LegacyNoAdjustments',
      TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustments,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustmentsNoTaxAmount,
        stage: 'LegacyNoAdjustmentsNoTaxAmount',
      }
    ));
  }
  if (isMissingSchemaColumn(error, 'discount_code_id')) {
    ({ data, error } = await runLegacyFallbackQuery(
      'LegacyNoDiscountCode',
      TRANSACTION_REVIEW_SELECTORS.legacyNoDiscountCode,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.legacyNoDiscountCodeNoTaxAmount,
        stage: 'LegacyNoDiscountCodeNoTaxAmount',
      }
    ));

    if (isTransactionReviewSchemaCacheError(error)) {
      ({ data, error } = await runLegacyFallbackQuery(
        'LegacyNoAdjustmentsNoDiscountCode',
        TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustmentsNoDiscountCode,
        {
          selectStatement:
            TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustmentsNoDiscountCodeNoTaxAmount,
          stage: 'LegacyNoAdjustmentsNoDiscountCodeNoTaxAmount',
        }
      ));
    }
  }

  return { data, error };
}
