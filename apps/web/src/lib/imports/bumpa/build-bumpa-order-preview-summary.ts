import type {
  ImportPreviewRow,
  ImportPreviewSummary,
  NormalizedImportedOrder,
} from './bumpa-types';

export function buildBumpaOrderPreviewSummary(
  rows: ImportPreviewRow<NormalizedImportedOrder>[]
) {
  return rows.reduce<ImportPreviewSummary>(
    (summary, row) => {
      summary.totalRows += 1;

      if (row.rowStatus === 'invalid') {
        summary.invalidRows += 1;
      } else {
        summary.validRows += 1;
      }

      if (row.rowStatus === 'create') summary.createCount += 1;
      if (row.rowStatus === 'update') summary.updateCount += 1;
      if (row.rowStatus === 'duplicate') summary.duplicateCount += 1;

      if (row.payload) {
        if (row.payload.customer.email) {
          summary.claimableCustomers += 1;
        } else if (row.payload.customer.phone) {
          summary.phoneOnlyCustomers += 1;
        } else {
          summary.anonymousCustomers += 1;
        }

        summary.unmatchedItems += row.payload.items.filter(
          (item) => !item.matched
        ).length;

        if (row.payload.paymentStatus === 'paid') {
          summary.receiptReadyOrders += 1;
        }
      }

      return summary;
    },
    {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      createCount: 0,
      updateCount: 0,
      duplicateCount: 0,
      claimableCustomers: 0,
      phoneOnlyCustomers: 0,
      anonymousCustomers: 0,
      unmatchedItems: 0,
      receiptReadyOrders: 0,
    }
  );
}
