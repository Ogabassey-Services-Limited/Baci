import { describe, expect, it } from 'vitest';
import {
  omitUnavailableTransactionReviewSchemaColumns,
  type TransactionReviewSchemaColumnAvailability,
} from './transaction-review-fallback-schema-columns';

const noUnavailableColumns: TransactionReviewSchemaColumnAvailability = {
  adTrackingUnavailable: false,
  cancelledAtUnavailable: false,
  discountAmountUnavailable: false,
  discountCodeUnavailable: false,
  quizAwardIdUnavailable: false,
  transactionDateUnavailable: false,
};

describe('omitUnavailableTransactionReviewSchemaColumns', () => {
  it('returns a selector unchanged when every column is available', () => {
    const selector = 'id, discount_amount, ad_tracking';

    expect(
      omitUnavailableTransactionReviewSchemaColumns(
        selector,
        noUnavailableColumns
      )
    ).toBe(selector);
  });

  it('removes only columns known to be unavailable', () => {
    const selector =
      'id, quiz_award_id, discount_code_id, discount_amount, ad_tracking, cancelled_at, transaction_date';

    expect(
      omitUnavailableTransactionReviewSchemaColumns(selector, {
        ...noUnavailableColumns,
        adTrackingUnavailable: true,
        discountAmountUnavailable: true,
        transactionDateUnavailable: true,
      })
    ).toBe('id, quiz_award_id, discount_code_id, cancelled_at');
  });
});
