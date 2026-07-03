import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: null }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

describe('isTransactionReviewSchemaCacheError', () => {
  it('keeps existing cost and supplier fields in the legacy fallback select', async () => {
    const { TRANSACTION_REVIEW_LEGACY_SELECT } = await import(
      './useTransactionReview'
    );

    expect(TRANSACTION_REVIEW_LEGACY_SELECT).toContain('cost_price');
    expect(TRANSACTION_REVIEW_LEGACY_SELECT).toContain('supplier_name');
    expect(TRANSACTION_REVIEW_LEGACY_SELECT).not.toContain(
      'order_item_unit_costs'
    );
  });

  it('returns true for missing transaction-review columns in PostgREST schema cache', async () => {
    const { isTransactionReviewSchemaCacheError } = await import(
      './useTransactionReview'
    );

    expect(
      isTransactionReviewSchemaCacheError({
        code: 'PGRST204',
        message:
          "Could not find the 'cost_price' column of 'order_items' in the schema cache",
      })
    ).toBe(true);
  });

  it('returns true for older orders tables missing transaction_date', async () => {
    const { isTransactionReviewSchemaCacheError } = await import(
      './useTransactionReview'
    );

    expect(
      isTransactionReviewSchemaCacheError({
        code: 'PGRST204',
        message:
          "Could not find the 'transaction_date' column of 'orders' in the schema cache",
      })
    ).toBe(true);
  });

  it('returns true for Postgres undefined-column responses from embedded order items', async () => {
    const { isTransactionReviewSchemaCacheError } = await import(
      './useTransactionReview'
    );

    expect(
      isTransactionReviewSchemaCacheError({
        code: '42703',
        message: 'column order_items_1.product_match_status does not exist',
      })
    ).toBe(true);
  });

  it('returns true when the unit-cost relation is missing from the schema cache', async () => {
    const { isTransactionReviewSchemaCacheError } = await import(
      './useTransactionReview'
    );

    expect(
      isTransactionReviewSchemaCacheError({
        code: 'PGRST200',
        message:
          "Could not find a relationship between 'order_items' and 'order_item_unit_costs' in the schema cache",
      })
    ).toBe(true);
  });

  it('returns false for non-schema errors', async () => {
    const { isTransactionReviewSchemaCacheError } = await import(
      './useTransactionReview'
    );

    expect(
      isTransactionReviewSchemaCacheError({
        code: '42501',
        message: 'permission denied for table orders',
      })
    ).toBe(false);
  });
});
