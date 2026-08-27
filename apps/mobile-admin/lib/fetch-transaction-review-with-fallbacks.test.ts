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
    for (let attempt = 0; attempt < 11; attempt += 1) {
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
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(12);
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[11][0].selectStatement
    ).not.toContain('variant_id');
  });

  it('tries the rich legacy projection before the discount-only compatibility fallback', async () => {
    const rows = [{ id: 'legacy-cost-order' }];
    for (let attempt = 0; attempt < 4; attempt += 1) {
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
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(5);
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[4][0].selectStatement
    ).toContain('cost_price');
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[4][0].selectStatement
    ).toContain('product_variants');
  });
});
