import { describe, expect, it } from 'vitest';
import { filterCancelledTransactionReviewRows } from './filter-cancelled-transaction-review-rows';

describe('filterCancelledTransactionReviewRows', () => {
  it('removes status and timestamp cancelled rows', () => {
    const activeRow = { id: 'active-order', shipping_status: 'pending' };
    const cancelledRow = {
      id: 'cancelled-order',
      shipping_status: 'cancelled',
    };
    const canceledRow = { id: 'canceled-order', shipping_status: 'canceled' };
    const timestampCancelledRow = {
      cancelled_at: '2026-07-21T00:00:00.000Z',
      id: 'timestamp-cancelled-order',
      shipping_status: 'pending',
    };
    const legacyRow = { id: 'legacy-order', shipping_status: null };

    const visibleRows = filterCancelledTransactionReviewRows([
      activeRow,
      cancelledRow,
      canceledRow,
      timestampCancelledRow,
      legacyRow,
    ]);

    expect(visibleRows).toEqual([activeRow, legacyRow]);
  });
});
