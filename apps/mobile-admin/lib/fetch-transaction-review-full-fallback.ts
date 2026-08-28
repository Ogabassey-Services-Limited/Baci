import type {
  TransactionReviewFallbackQuery,
  TransactionReviewQueryError,
} from './fetch-transaction-review-rich-fallback';
import type { fetchTransactionReviewRows } from './fetch-transaction-review-rows';
import { TRANSACTION_REVIEW_SELECTORS } from './transaction-review-selectors';

type TransactionReviewQueryOptions = Parameters<
  typeof fetchTransactionReviewRows
>[0];
type TransactionReviewQueryResult = Awaited<
  ReturnType<typeof fetchTransactionReviewRows>
>;
type TaxAmountFallback = Readonly<{
  selectStatement: string;
  stage: string;
}>;

type FullFallbackFlags = Readonly<{
  discountAmountUnavailable: boolean;
  discountCodeUnavailable: boolean;
  variantIdUnavailable: boolean;
}>;

type FullFallbackProjection = Readonly<{
  selectStatement: string;
  selectStatementNoTaxAmount: string;
  stage: string;
}>;

interface FullFallbackDependencies {
  isMissingSchemaColumn: (
    error: TransactionReviewQueryError,
    column: string
  ) => boolean;
  runQueryWithTaxFallback: (
    stage: string,
    options: TransactionReviewQueryOptions,
    taxAmountFallback: TaxAmountFallback
  ) => Promise<TransactionReviewQueryResult>;
}

function getFullFallbackProjection(
  flags: FullFallbackFlags
): FullFallbackProjection {
  const {
    discountAmountUnavailable,
    discountCodeUnavailable,
    variantIdUnavailable,
  } = flags;

  if (variantIdUnavailable && discountCodeUnavailable) {
    return discountAmountUnavailable
      ? {
          selectStatement:
            TRANSACTION_REVIEW_SELECTORS.fullNoVariantIdNoDiscountCodeNoDiscount,
          selectStatementNoTaxAmount:
            TRANSACTION_REVIEW_SELECTORS.fullNoVariantIdNoDiscountCodeNoDiscountNoTaxAmount,
          stage: 'FullNoVariantIdNoDiscountCodeNoDiscount',
        }
      : {
          selectStatement:
            TRANSACTION_REVIEW_SELECTORS.fullNoVariantIdNoDiscountCode,
          selectStatementNoTaxAmount:
            TRANSACTION_REVIEW_SELECTORS.fullNoVariantIdNoDiscountCodeNoTaxAmount,
          stage: 'FullNoVariantIdNoDiscountCode',
        };
  }

  if (variantIdUnavailable && discountAmountUnavailable) {
    return {
      selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoVariantIdNoDiscount,
      selectStatementNoTaxAmount:
        TRANSACTION_REVIEW_SELECTORS.fullNoVariantIdNoDiscountNoTaxAmount,
      stage: 'FullNoVariantIdNoDiscount',
    };
  }

  if (discountCodeUnavailable && discountAmountUnavailable) {
    return {
      selectStatement:
        TRANSACTION_REVIEW_SELECTORS.fullNoDiscountCodeNoDiscount,
      selectStatementNoTaxAmount:
        TRANSACTION_REVIEW_SELECTORS.fullNoDiscountCodeNoDiscountNoTaxAmount,
      stage: 'FullNoDiscountCodeNoDiscount',
    };
  }

  if (variantIdUnavailable) {
    return {
      selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoVariantId,
      selectStatementNoTaxAmount:
        TRANSACTION_REVIEW_SELECTORS.fullNoVariantIdNoTaxAmount,
      stage: 'FullNoVariantId',
    };
  }

  if (discountCodeUnavailable) {
    return {
      selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoDiscountCode,
      selectStatementNoTaxAmount:
        TRANSACTION_REVIEW_SELECTORS.fullNoDiscountCodeNoTaxAmount,
      stage: 'FullNoDiscountCode',
    };
  }

  if (discountAmountUnavailable) {
    return {
      selectStatement: TRANSACTION_REVIEW_SELECTORS.fullNoDiscount,
      selectStatementNoTaxAmount:
        TRANSACTION_REVIEW_SELECTORS.fullNoDiscountNoTaxAmount,
      stage: 'FullNoDiscount',
    };
  }

  return {
    selectStatement: TRANSACTION_REVIEW_SELECTORS.full,
    selectStatementNoTaxAmount: TRANSACTION_REVIEW_SELECTORS.fullNoTaxAmount,
    stage: 'Full',
  };
}

export async function fetchFullTransactionReviewRows(
  query: TransactionReviewFallbackQuery,
  { isMissingSchemaColumn, runQueryWithTaxFallback }: FullFallbackDependencies
) {
  const {
    endDateFilter,
    endDateIso,
    merchantId,
    startDateFilter,
    startDateIso,
  } = query;
  const baseOptions = {
    endDateFilter,
    endDateIso,
    includeCancelledAt: true,
    includeTransactionDate: true,
    merchantId,
    startDateFilter,
    startDateIso,
  };
  let flags: FullFallbackFlags = {
    discountAmountUnavailable: false,
    discountCodeUnavailable: false,
    variantIdUnavailable: false,
  };
  const attemptedStages = new Set<string>();
  let projection = getFullFallbackProjection(flags);
  let data: TransactionReviewQueryResult['data'] = null;
  let error: TransactionReviewQueryResult['error'] = null;

  while (!attemptedStages.has(projection.stage)) {
    attemptedStages.add(projection.stage);
    ({ data, error } = await runQueryWithTaxFallback(
      projection.stage,
      {
        ...baseOptions,
        selectStatement: projection.selectStatement,
      },
      {
        selectStatement: projection.selectStatementNoTaxAmount,
        stage: `${projection.stage}NoTaxAmount`,
      }
    ));

    const nextFlags = {
      discountAmountUnavailable:
        flags.discountAmountUnavailable ||
        isMissingSchemaColumn(error, 'discount_amount'),
      discountCodeUnavailable:
        flags.discountCodeUnavailable ||
        isMissingSchemaColumn(error, 'discount_code_id'),
      variantIdUnavailable:
        flags.variantIdUnavailable ||
        isMissingSchemaColumn(error, 'variant_id'),
    };
    if (
      nextFlags.discountAmountUnavailable === flags.discountAmountUnavailable &&
      nextFlags.discountCodeUnavailable === flags.discountCodeUnavailable &&
      nextFlags.variantIdUnavailable === flags.variantIdUnavailable
    ) {
      break;
    }
    flags = nextFlags;
    projection = getFullFallbackProjection(flags);
  }

  return { data, error };
}
