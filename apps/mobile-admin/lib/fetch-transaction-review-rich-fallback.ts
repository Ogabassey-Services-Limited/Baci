import { fetchFullTransactionReviewRows } from './fetch-transaction-review-full-fallback';
import { isMissingSchemaColumn } from './is-missing-transaction-review-schema-column';
import { isTransactionReviewSchemaCacheError } from './is-transaction-review-schema-cache-error';
import { runLegacyTransactionReviewQuery } from './run-legacy-transaction-review-query';
import { runTransactionReviewQueryWithTaxFallback } from './run-transaction-review-query-with-tax-fallback';
import type {
  TaxAmountFallback,
  TransactionReviewFallbackQuery,
  TransactionReviewFallbackStage,
} from './transaction-review-fallback-types';
import { TRANSACTION_REVIEW_SELECTORS } from './transaction-review-selectors';

type TransactionReviewFallbackCallbacks = Readonly<{
  onMissingSchemaColumn?: (column: string) => void;
}>;

function withoutQuizAwardId(selector: string) {
  return selector.replace(', quiz_award_id', '');
}

function withoutAdTracking(selector: string) {
  return selector.replace(', ad_tracking', '');
}

function withoutCancelledAt(selector: string) {
  return selector.replace(', cancelled_at', '');
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
  let adTrackingUnavailable = false;
  let cancelledAtUnavailable = false;
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
        if (column === 'ad_tracking') {
          adTrackingUnavailable = true;
        }
        if (column === 'cancelled_at') {
          cancelledAtUnavailable = true;
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
    const omitUnavailableSchemaColumns = (selector: string) => {
      let result = selector;
      if (quizAwardIdUnavailable) {
        result = withoutQuizAwardId(result);
      }
      if (adTrackingUnavailable) {
        result = withoutAdTracking(result);
      }
      if (cancelledAtUnavailable) {
        result = withoutCancelledAt(result);
      }
      return result;
    };

    const runQuery = () =>
      runLegacyTransactionReviewQuery(
        stage,
        legacyQuery,
        omitUnavailableSchemaColumns(selectStatement),
        !cancelledAtUnavailable,
        taxAmountFallback
          ? {
              ...taxAmountFallback,
              selectStatement: omitUnavailableSchemaColumns(
                taxAmountFallback.selectStatement
              ),
            }
          : undefined
      );

    let result = await runQuery();
    while (true) {
      let shouldRetry = false;
      if (
        !quizAwardIdUnavailable &&
        isMissingSchemaColumn(result.error, 'quiz_award_id')
      ) {
        quizAwardIdUnavailable = true;
        onMissingSchemaColumn?.('quiz_award_id');
        shouldRetry = true;
      }
      if (
        !adTrackingUnavailable &&
        isMissingSchemaColumn(result.error, 'ad_tracking')
      ) {
        adTrackingUnavailable = true;
        onMissingSchemaColumn?.('ad_tracking');
        shouldRetry = true;
      }
      if (
        !cancelledAtUnavailable &&
        isMissingSchemaColumn(result.error, 'cancelled_at')
      ) {
        cancelledAtUnavailable = true;
        onMissingSchemaColumn?.('cancelled_at');
        shouldRetry = true;
      }
      if (!shouldRetry) {
        break;
      }
      result = await runQuery();
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
