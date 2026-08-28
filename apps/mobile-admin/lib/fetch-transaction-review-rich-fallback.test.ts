import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRichTransactionReviewRows } from './fetch-transaction-review-rich-fallback';

const { mockFetchTransactionReviewRows } = vi.hoisted(() => ({
  mockFetchTransactionReviewRows: vi.fn(),
}));

vi.mock('./fetch-transaction-review-rows', () => ({
  fetchTransactionReviewRows: mockFetchTransactionReviewRows,
}));

describe('fetchRichTransactionReviewRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries a rich projection without tax when that column is unavailable', async () => {
    const rows = [{ id: 'rich-tax-fallback-order' }];
    mockFetchTransactionReviewRows
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message:
            "Could not find the 'tax_amount' column of 'orders' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchRichTransactionReviewRows({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mockFetchTransactionReviewRows).toHaveBeenCalledTimes(2);
    const selector = mockFetchTransactionReviewRows.mock.calls[1][0]
      .selectStatement as string;
    expect(selector).not.toContain('tax_amount');
    expect(selector).toContain('discount_amount');
    expect(selector).toContain('discount_code_id');
    expect(selector).toContain('order_item_unit_costs');
  });
});
