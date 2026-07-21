import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  gte: vi.fn(),
  limit: vi.fn(),
  lte: vi.fn(),
  neq: vi.fn(),
  or: vi.fn(),
  order: vi.fn(),
  select: vi.fn(),
}));

const query = {
  eq: mocks.eq,
  gte: mocks.gte,
  limit: mocks.limit,
  lte: mocks.lte,
  neq: mocks.neq,
  or: mocks.or,
  order: mocks.order,
  select: mocks.select,
};

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: null }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.neq.mockReturnValue(query);
  mocks.order.mockReturnValue(query);
  mocks.or.mockReturnValue(query);
  mocks.gte.mockReturnValue(query);
  mocks.lte.mockReturnValue(query);
  mocks.limit.mockResolvedValue({ data: [], error: null });
});

describe('transaction review visibility', () => {
  it('excludes cancelled orders from transaction review queries', async () => {
    const { fetchTransactionReviewRows } = await import(
      './useTransactionReview'
    );

    await fetchTransactionReviewRows({
      includeTransactionDate: true,
      merchantId: 'merchant-1',
      selectStatement: 'id',
    });

    expect(mocks.or).toHaveBeenCalledWith(
      'shipping_status.is.null,shipping_status.neq.cancelled'
    );
  });

  it('removes cancelled rows returned by the transaction query', async () => {
    const { filterCancelledTransactionReviewRows } = await import(
      './useTransactionReview'
    );
    const activeRow = { id: 'active-order', shipping_status: 'pending' };
    const cancelledRow = {
      id: 'cancelled-order',
      shipping_status: 'cancelled',
    };
    const legacyRow = { id: 'legacy-order', shipping_status: null };

    const visibleRows = filterCancelledTransactionReviewRows([
      activeRow,
      cancelledRow,
      legacyRow,
    ]);

    expect(visibleRows).toEqual([activeRow, legacyRow]);
  });
});

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
