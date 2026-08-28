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
  lineIdUnavailable: boolean;
  quizAwardIdUnavailable: boolean;
  transactionDateUnavailable: boolean;
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
  onMissingSchemaColumn?: (column: string) => void;
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

  const projection = (() => {
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
  })();

  return applyMissingColumns(projection, flags);
}

function applyMissingColumns(
  projection: FullFallbackProjection,
  flags: FullFallbackFlags
): FullFallbackProjection {
  let selectStatement = projection.selectStatement;
  let selectStatementNoTaxAmount = projection.selectStatementNoTaxAmount;
  let stage = projection.stage;

  if (flags.lineIdUnavailable) {
    selectStatement = withoutLineId(selectStatement);
    selectStatementNoTaxAmount = withoutLineId(selectStatementNoTaxAmount);
    stage = `${stage}NoLineId`;
  }
  if (flags.transactionDateUnavailable) {
    selectStatement = withoutTransactionDate(selectStatement);
    selectStatementNoTaxAmount = withoutTransactionDate(
      selectStatementNoTaxAmount
    );
    stage = `${stage}NoTransactionDate`;
  }
  if (flags.quizAwardIdUnavailable) {
    selectStatement = withoutQuizAwardId(selectStatement);
    selectStatementNoTaxAmount = withoutQuizAwardId(selectStatementNoTaxAmount);
    stage = `${stage}NoQuizAwardId`;
  }

  return {
    selectStatement,
    selectStatementNoTaxAmount,
    stage,
  };
}

function withoutLineId(selector: string) {
  return selector.replace('order_items(id, line_id, ', 'order_items(id, ');
}

function withoutTransactionDate(selector: string) {
  return selector.replace(', transaction_date', '');
}

function withoutQuizAwardId(selector: string) {
  return selector.replace(', quiz_award_id', '');
}

export async function fetchFullTransactionReviewRows(
  query: TransactionReviewFallbackQuery,
  {
    isMissingSchemaColumn,
    onMissingSchemaColumn,
    runQueryWithTaxFallback,
  }: FullFallbackDependencies
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
    merchantId,
    startDateFilter,
    startDateIso,
  };
  let flags: FullFallbackFlags = {
    discountAmountUnavailable: false,
    discountCodeUnavailable: false,
    lineIdUnavailable: false,
    quizAwardIdUnavailable: false,
    transactionDateUnavailable: false,
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
        includeTransactionDate: !flags.transactionDateUnavailable,
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
      lineIdUnavailable:
        flags.lineIdUnavailable || isMissingSchemaColumn(error, 'line_id'),
      quizAwardIdUnavailable:
        flags.quizAwardIdUnavailable ||
        isMissingSchemaColumn(error, 'quiz_award_id'),
      transactionDateUnavailable:
        flags.transactionDateUnavailable ||
        isMissingSchemaColumn(error, 'transaction_date'),
      variantIdUnavailable:
        flags.variantIdUnavailable ||
        isMissingSchemaColumn(error, 'variant_id'),
    };
    if (nextFlags.quizAwardIdUnavailable && !flags.quizAwardIdUnavailable) {
      onMissingSchemaColumn?.('quiz_award_id');
    }
    if (nextFlags.lineIdUnavailable && !flags.lineIdUnavailable) {
      onMissingSchemaColumn?.('line_id');
    }
    if (
      nextFlags.transactionDateUnavailable &&
      !flags.transactionDateUnavailable
    ) {
      onMissingSchemaColumn?.('transaction_date');
    }
    if (
      nextFlags.discountAmountUnavailable === flags.discountAmountUnavailable &&
      nextFlags.discountCodeUnavailable === flags.discountCodeUnavailable &&
      nextFlags.lineIdUnavailable === flags.lineIdUnavailable &&
      nextFlags.quizAwardIdUnavailable === flags.quizAwardIdUnavailable &&
      nextFlags.transactionDateUnavailable ===
        flags.transactionDateUnavailable &&
      nextFlags.variantIdUnavailable === flags.variantIdUnavailable
    ) {
      break;
    }
    flags = nextFlags;
    projection = getFullFallbackProjection(flags);
  }

  return { data, error };
}
