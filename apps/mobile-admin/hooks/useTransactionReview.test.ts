import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchTransactionReviewRows: vi.fn(),
  mapTransactionOrderRows: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@/lib/fetch-transaction-review-rows', () => ({
  fetchTransactionReviewRows: mocks.fetchTransactionReviewRows,
}));

vi.mock('@/lib/transaction-review', () => ({
  buildTransactionReviewRangeFilters: () => ({}),
  mapTransactionOrderRows: mocks.mapTransactionOrderRows,
}));

import { useTransactionReview } from './useTransactionReview';

describe('useTransactionReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQuery.mockImplementation((options) => options);
    mocks.mapTransactionOrderRows.mockImplementation((rows) => rows);
  });

  it('keeps timestamp cancellation filtering after a full schema fallback', async () => {
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message:
            "Could not find the 'order_item_unit_costs' relationship in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            cancelled_at: '2026-07-21T00:00:00.000Z',
            id: 'cancelled-order',
            shipping_status: 'pending',
          },
        ],
        error: null,
      });

    const query = useTransactionReview() as unknown as {
      queryFn: () => Promise<unknown>;
    };

    const result = await query.queryFn();

    expect(mocks.fetchTransactionReviewRows).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        includeCancelledAt: true,
        selectStatement: expect.stringContaining('cancelled_at'),
      })
    );
    expect(mocks.mapTransactionOrderRows).toHaveBeenCalledWith([]);
    expect(result).toEqual([]);
  });
});
