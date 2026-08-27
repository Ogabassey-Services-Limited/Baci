import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchTransactionReviewRows: vi.fn(),
}));

vi.mock('./fetch-transaction-review-rows', () => ({
  fetchTransactionReviewRows: mocks.fetchTransactionReviewRows,
}));

import { fetchTransactionReviewWithFallbacks } from './fetch-transaction-review-with-fallbacks';

const schemaCacheError = {
  code: 'PGRST204',
  message:
    "Could not find the 'variant_id' column of 'order_items' in the schema cache",
};

describe('fetchTransactionReviewWithFallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the full projection without retrying when the schema is current', async () => {
    const rows = [{ id: 'order-1' }];
    mocks.fetchTransactionReviewRows.mockResolvedValueOnce({
      data: rows,
      error: null,
    });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(1);
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledWith(
      expect.objectContaining({
        includeCancelledAt: true,
        includeTransactionDate: true,
      })
    );
  });

  it('uses the final projection without variant_id after schema-cache retries', async () => {
    const rows = [{ id: 'legacy-order' }];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      mocks.fetchTransactionReviewRows.mockResolvedValueOnce({
        data: null,
        error: schemaCacheError,
      });
    }
    mocks.fetchTransactionReviewRows.mockResolvedValueOnce({
      data: rows,
      error: null,
    });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(13);
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[12][0].selectStatement
    ).not.toContain('variant_id');
  });

  it('preserves cost relationships when adjustment columns are unavailable', async () => {
    const rows = [{ id: 'legacy-adjustment-order' }];
    const adjustmentSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'vat_rate' column of 'order_items' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({ data: null, error: adjustmentSchemaError })
      .mockResolvedValueOnce({ data: null, error: adjustmentSchemaError })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(3);
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[2][0].selectStatement
    ).toContain('order_item_unit_costs');
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[2][0].selectStatement
    ).not.toContain('vat_rate');
  });

  it('preserves cost relationships when discount code ids are unavailable', async () => {
    const rows = [{ id: 'legacy-discount-code-order' }];
    const discountCodeSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'discount_code_id' column of 'orders' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({ data: null, error: discountCodeSchemaError })
      .mockResolvedValueOnce({ data: null, error: discountCodeSchemaError })
      .mockResolvedValueOnce({ data: null, error: discountCodeSchemaError })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(4);
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[3][0].selectStatement
    ).toContain('order_item_unit_costs');
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[3][0].selectStatement
    ).not.toContain('discount_code_id');
  });

  it('tries the rich legacy projection before the discount-only compatibility fallback', async () => {
    const rows = [{ id: 'legacy-cost-order' }];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      mocks.fetchTransactionReviewRows.mockResolvedValueOnce({
        data: null,
        error: schemaCacheError,
      });
    }
    mocks.fetchTransactionReviewRows.mockResolvedValueOnce({
      data: rows,
      error: null,
    });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(6);
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[5][0].selectStatement
    ).toContain('cost_price');
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[5][0].selectStatement
    ).toContain('product_variants');
  });
});
