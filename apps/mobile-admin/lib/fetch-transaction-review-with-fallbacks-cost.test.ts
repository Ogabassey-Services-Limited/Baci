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

describe('fetchTransactionReviewWithFallbacks cost fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
