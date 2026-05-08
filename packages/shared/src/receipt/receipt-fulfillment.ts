import { getFirstNonBlankString } from '../lib/string-values';
import type { ReceiptOrder } from './types';

export interface ReceiptFulfillmentRow {
  label: string;
  value: string;
}

export function getReceiptFulfillmentRows(
  order: ReceiptOrder
): ReceiptFulfillmentRow[] {
  const details = order.fulfillment_details;
  const imei = getFirstNonBlankString(details?.imei);
  const serialNumber = getFirstNonBlankString(
    details?.serialNumber,
    details?.serial_number
  );

  return [
    { label: 'IMEI', value: imei },
    { label: 'S/N', value: serialNumber },
  ].filter((row) => row.value.length > 0);
}
