import type { Order } from '@baci/shared';
import { format } from 'date-fns';
import { buildOrdersCsv } from './buildOrdersCsv';
import { loadOrderExportNativeModules } from './loadOrderExportNativeModules';

export async function exportOrdersCsv(orders: Order[]): Promise<void> {
  const { FileSystem, Sharing } = await loadOrderExportNativeModules();

  if (!FileSystem || !Sharing) {
    throw new Error('Export modules not available');
  }

  const csvData = buildOrdersCsv(orders);
  const filename = `orders_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
  const documentDirectory = FileSystem.documentDirectory;

  if (!documentDirectory) {
    throw new Error('Export modules not available');
  }

  const fileUri = `${
    documentDirectory.endsWith('/') ? documentDirectory : `${documentDirectory}/`
  }${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, csvData);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Export Orders Report',
    mimeType: 'text/csv',
  });
}
