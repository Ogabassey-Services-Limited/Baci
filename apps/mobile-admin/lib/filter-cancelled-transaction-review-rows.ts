export function filterCancelledTransactionReviewRows<
  T extends {
    cancelled_at?: string | null;
    shipping_status?: string | null;
  },
>(rows: T[]) {
  return rows.filter(
    (row) =>
      row.cancelled_at == null &&
      row.shipping_status !== 'cancelled' &&
      row.shipping_status !== 'canceled'
  );
}
