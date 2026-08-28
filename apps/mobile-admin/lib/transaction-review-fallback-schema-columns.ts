export type TransactionReviewSchemaColumnAvailability = Readonly<{
  adTrackingUnavailable: boolean;
  cancelledAtUnavailable: boolean;
  discountAmountUnavailable: boolean;
  discountCodeUnavailable: boolean;
  quizAwardIdUnavailable: boolean;
  transactionDateUnavailable: boolean;
}>;

function withoutSchemaColumn(selector: string, column: string) {
  return selector.replace(`, ${column}`, '');
}

export function omitUnavailableTransactionReviewSchemaColumns(
  selector: string,
  availability: TransactionReviewSchemaColumnAvailability
) {
  let result = selector;
  if (availability.quizAwardIdUnavailable) {
    result = withoutSchemaColumn(result, 'quiz_award_id');
  }
  if (availability.discountCodeUnavailable) {
    result = withoutSchemaColumn(result, 'discount_code_id');
  }
  if (availability.discountAmountUnavailable) {
    result = withoutSchemaColumn(result, 'discount_amount');
  }
  if (availability.adTrackingUnavailable) {
    result = withoutSchemaColumn(result, 'ad_tracking');
  }
  if (availability.cancelledAtUnavailable) {
    result = withoutSchemaColumn(result, 'cancelled_at');
  }
  if (availability.transactionDateUnavailable) {
    result = withoutSchemaColumn(result, 'transaction_date');
  }
  return result;
}
