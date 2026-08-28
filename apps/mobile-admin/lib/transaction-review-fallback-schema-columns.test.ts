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
  lineIdUnavailable: false,
  quizAwardIdUnavailable: false,
  transactionDateUnavailable: false,
  variantIdUnavailable: false,
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

  it('removes the variant relationship when the variant id is unavailable', () => {
    const selector =
      'id, order_items(id, variant_id, product_variants(cost_price, sku, attributes, condition))';

    expect(
      omitUnavailableTransactionReviewSchemaColumns(selector, {
        ...noUnavailableColumns,
        variantIdUnavailable: true,
      })
    ).toBe('id, order_items(id)');
  });

  it('keeps rich fields while removing a missing line id', () => {
    const selector =
      'id, order_items(id, line_id, variant_id, order_item_unit_costs(unit_index, cost_price))';

    expect(
      omitUnavailableTransactionReviewSchemaColumns(selector, {
        ...noUnavailableColumns,
        lineIdUnavailable: true,
      })
    ).toBe(
      'id, order_items(id, variant_id, order_item_unit_costs(unit_index, cost_price))'
    );
  });
});
