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

const withoutSchemaColumn = (selector: string, column: string) =>
  selector.replace(`, ${column}`, '');

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
  const unavailableSchemaColumns = new Set<string>();
  const markUnavailableSchemaColumn = (column: string) => {
    unavailableSchemaColumns.add(column);
  };
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
        markUnavailableSchemaColumn(column);
        onMissingSchemaColumn?.(column);
      },
      runQueryWithTaxFallback: runTransactionReviewQueryWithTaxFallback,
    }
  );

  if (isMissingSchemaColumn(error, 'variant_attributes')) {
    markUnavailableSchemaColumn('variant_attributes');
  }
  if (isMissingSchemaColumn(error, 'product_match_status')) {
    markUnavailableSchemaColumn('product_match_status');
  }
  if (isMissingSchemaColumn(error, 'discount_code_id')) {
    markUnavailableSchemaColumn('discount_code_id');
  }

  const runLegacyFallbackQuery = async (
    stage: TransactionReviewFallbackStage,
    selectStatement: string,
    taxAmountFallback?: TaxAmountFallback
  ) => {
    const omitUnavailableSchemaColumns = (selector: string) => {
      let result = selector;
      if (unavailableSchemaColumns.has('quiz_award_id')) {
        result = withoutSchemaColumn(result, 'quiz_award_id');
      }
      if (unavailableSchemaColumns.has('ad_tracking')) {
        result = withoutSchemaColumn(result, 'ad_tracking');
      }
      if (unavailableSchemaColumns.has('cancelled_at')) {
        result = withoutSchemaColumn(result, 'cancelled_at');
      }
      if (unavailableSchemaColumns.has('variant_attributes')) {
        result = withoutSchemaColumn(result, 'variant_attributes');
      }
      if (unavailableSchemaColumns.has('product_match_status')) {
        result = withoutSchemaColumn(result, 'product_match_status');
      }
      if (unavailableSchemaColumns.has('discount_code_id')) {
        result = withoutSchemaColumn(result, 'discount_code_id');
      }
      if (unavailableSchemaColumns.has('transaction_date')) {
        result = withoutSchemaColumn(result, 'transaction_date');
      }
      return result;
    };

    const runQuery = () =>
      runLegacyTransactionReviewQuery(
        stage,
        legacyQuery,
        omitUnavailableSchemaColumns(selectStatement),
        !unavailableSchemaColumns.has('cancelled_at'),
        taxAmountFallback
          ? {
              ...taxAmountFallback,
              selectStatement: omitUnavailableSchemaColumns(
                taxAmountFallback.selectStatement
              ),
            }
          : undefined,
        !unavailableSchemaColumns.has('transaction_date')
      );

    let result = await runQuery();
    while (true) {
      let shouldRetry = false;
      if (
        !unavailableSchemaColumns.has('quiz_award_id') &&
        isMissingSchemaColumn(result.error, 'quiz_award_id')
      ) {
        markUnavailableSchemaColumn('quiz_award_id');
        onMissingSchemaColumn?.('quiz_award_id');
        shouldRetry = true;
      }
      if (
        !unavailableSchemaColumns.has('ad_tracking') &&
        isMissingSchemaColumn(result.error, 'ad_tracking')
      ) {
        markUnavailableSchemaColumn('ad_tracking');
        onMissingSchemaColumn?.('ad_tracking');
        shouldRetry = true;
      }
      if (
        !unavailableSchemaColumns.has('cancelled_at') &&
        isMissingSchemaColumn(result.error, 'cancelled_at')
      ) {
        markUnavailableSchemaColumn('cancelled_at');
        onMissingSchemaColumn?.('cancelled_at');
        shouldRetry = true;
      }
      if (
        !unavailableSchemaColumns.has('variant_attributes') &&
        isMissingSchemaColumn(result.error, 'variant_attributes')
      ) {
        markUnavailableSchemaColumn('variant_attributes');
        onMissingSchemaColumn?.('variant_attributes');
        shouldRetry = true;
      }
      if (
        !unavailableSchemaColumns.has('product_match_status') &&
        isMissingSchemaColumn(result.error, 'product_match_status')
      ) {
        markUnavailableSchemaColumn('product_match_status');
        onMissingSchemaColumn?.('product_match_status');
        shouldRetry = true;
      }
      if (
        (stage.includes('VariantAttributes') ||
          stage === 'LegacyNoProductMatchStatus') &&
        !unavailableSchemaColumns.has('discount_code_id') &&
        isMissingSchemaColumn(result.error, 'discount_code_id')
      ) {
        markUnavailableSchemaColumn('discount_code_id');
        onMissingSchemaColumn?.('discount_code_id');
        shouldRetry = true;
      }
      if (
        !unavailableSchemaColumns.has('transaction_date') &&
        isMissingSchemaColumn(result.error, 'transaction_date')
      ) {
        markUnavailableSchemaColumn('transaction_date');
        onMissingSchemaColumn?.('transaction_date');
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
    const variantAttributesSelector = unavailableSchemaColumns.has(
      'product_match_status'
    )
      ? unavailableSchemaColumns.has('discount_code_id')
        ? TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributesNoProductMatchStatusNoDiscountCode
        : TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributesNoProductMatchStatus
      : unavailableSchemaColumns.has('discount_code_id')
        ? TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributesNoDiscountCode
        : TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributes;
    const variantAttributesSelectorNoTaxAmount = withoutSchemaColumn(
      variantAttributesSelector,
      'tax_amount'
    );

    ({ data, error } = await runLegacyFallbackQuery(
      'LegacyNoVariantAttributes',
      variantAttributesSelector,
      {
        selectStatement: variantAttributesSelectorNoTaxAmount,
        stage: 'LegacyNoVariantAttributesNoTaxAmount',
      }
    ));

    if (isMissingSchemaColumn(error, 'order_item_unit_costs')) {
      const noLaterFieldsSelector = unavailableSchemaColumns.has(
        'product_match_status'
      )
        ? TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributesNoProductMatchStatusNoLaterFields
        : TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributesNoLaterFields;
      const noLaterFieldsSelectorNoTaxAmount = withoutSchemaColumn(
        noLaterFieldsSelector,
        'tax_amount'
      );

      ({ data, error } = await runLegacyFallbackQuery(
        'LegacyNoVariantAttributesNoLaterFields',
        noLaterFieldsSelector,
        {
          selectStatement: noLaterFieldsSelectorNoTaxAmount,
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
