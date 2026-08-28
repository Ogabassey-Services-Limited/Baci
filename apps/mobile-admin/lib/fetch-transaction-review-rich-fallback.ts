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

type TransactionReviewQueryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
} | null;

type TransactionReviewFallbackStage = string;

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
export async function fetchRichTransactionReviewRows({
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
  let { data, error } = await runTransactionReviewQueryWithTaxFallback(
    'Full',
    {
      endDateFilter,
      endDateIso,
      includeCancelledAt: true,
      includeTransactionDate: true,
      merchantId,
      selectStatement: TRANSACTION_REVIEW_SELECTORS.full,
      startDateFilter,
      startDateIso,
    },
    {
      selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoTaxAmount,
      stage: 'FullNoTaxAmount',
    }
  );

  if (isMissingSchemaColumn(error, 'discount_code_id')) {
    ({ data, error } = await runTransactionReviewQueryWithTaxFallback(
      'FullNoDiscountCode',
      {
        endDateFilter,
        endDateIso,
        includeCancelledAt: true,
        includeTransactionDate: true,
        merchantId,
        selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoDiscountCode,
        startDateFilter,
        startDateIso,
      },
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.fullNoDiscountCodeNoTaxAmount,
        stage: 'FullNoDiscountCodeNoTaxAmount',
      }
    ));
  }

  if (isMissingSchemaColumn(error, 'discount_amount')) {
    ({ data, error } = await runTransactionReviewQueryWithTaxFallback(
      'FullNoDiscount',
      {
        endDateFilter,
        endDateIso,
        includeCancelledAt: true,
        includeTransactionDate: true,
        merchantId,
        selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoDiscount,
        startDateFilter,
        startDateIso,
      },
      {
        selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoDiscountNoTaxAmount,
        stage: 'FullNoDiscountNoTaxAmount',
      }
    ));
  }

  if (isMissingSchemaColumn(error, 'variant_attributes')) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'LegacyNoVariantAttributes',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributes,
      true,
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
      ({ data, error } = await runLegacyTransactionReviewQuery(
        'LegacyNoVariantAttributesNoLaterFields',
        legacyQuery,
        TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributesNoLaterFields,
        true,
        {
          selectStatement:
            TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributesNoLaterFieldsNoTaxAmount,
          stage: 'LegacyNoVariantAttributesNoLaterFieldsNoTaxAmount',
        }
      ));
    }
  }

  if (isMissingSchemaColumn(error, 'product_match_status')) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'LegacyNoProductMatchStatus',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacyNoProductMatchStatus,
      true,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.legacyNoProductMatchStatusNoTaxAmount,
        stage: 'LegacyNoProductMatchStatusNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'Legacy',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacy,
      true,
      {
        selectStatement: TRANSACTION_REVIEW_SELECTORS.legacyNoTaxAmount,
        stage: 'LegacyNoTaxAmount',
      }
    ));
  }
  if (isTransactionReviewSchemaCacheError(error)) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'LegacyNoAdjustments',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustments,
      true,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustmentsNoTaxAmount,
        stage: 'LegacyNoAdjustmentsNoTaxAmount',
      }
    ));
  }
  if (isMissingSchemaColumn(error, 'discount_code_id')) {
    ({ data, error } = await runLegacyTransactionReviewQuery(
      'LegacyNoDiscountCode',
      legacyQuery,
      TRANSACTION_REVIEW_SELECTORS.legacyNoDiscountCode,
      true,
      {
        selectStatement:
          TRANSACTION_REVIEW_SELECTORS.legacyNoDiscountCodeNoTaxAmount,
        stage: 'LegacyNoDiscountCodeNoTaxAmount',
      }
    ));

    if (isTransactionReviewSchemaCacheError(error)) {
      ({ data, error } = await runLegacyTransactionReviewQuery(
        'LegacyNoAdjustmentsNoDiscountCode',
        legacyQuery,
        TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustmentsNoDiscountCode,
        true,
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
