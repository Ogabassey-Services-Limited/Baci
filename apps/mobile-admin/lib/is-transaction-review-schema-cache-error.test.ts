import { describe, expect, it } from 'vitest';
import { isTransactionReviewSchemaCacheError } from './is-transaction-review-schema-cache-error';

describe('isTransactionReviewSchemaCacheError', () => {
  it('returns true for missing transaction-review columns in the schema cache', () => {
    expect(
      isTransactionReviewSchemaCacheError({
        code: 'PGRST204',
        message:
          "Could not find the 'cost_price' column of 'order_items' in the schema cache",
      })
    ).toBe(true);
  });

  it('returns true for older orders tables missing transaction_date', () => {
    expect(
      isTransactionReviewSchemaCacheError({
        code: 'PGRST204',
        message:
          "Could not find the 'transaction_date' column of 'orders' in the schema cache",
      })
    ).toBe(true);
  });

  it('returns true for undefined-column responses from embedded order items', () => {
    expect(
      isTransactionReviewSchemaCacheError({
        code: '42703',
        message: 'column order_items_1.product_match_status does not exist',
      })
    ).toBe(true);
  });

  it('returns true when the unit-cost relation is missing from the schema cache', () => {
    expect(
      isTransactionReviewSchemaCacheError({
        code: 'PGRST200',
        message:
          "Could not find a relationship between 'order_items' and 'order_item_unit_costs' in the schema cache",
      })
    ).toBe(true);
  });

  it('returns false for non-schema errors', () => {
    expect(
      isTransactionReviewSchemaCacheError({
        code: '42501',
        message: 'permission denied for table orders',
      })
    ).toBe(false);
  });
});
