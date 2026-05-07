import type { ReceiptOrder } from './types';

export interface ReceiptFulfillmentRow {
  label: string;
  value: string;
}

function getFirstNonBlankValue(
  ...values: Array<string | null | undefined>
): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

export function getReceiptFulfillmentRows(
  order: ReceiptOrder
): ReceiptFulfillmentRow[] {
  const details = order.fulfillment_details;
  const imei = getFirstNonBlankValue(details?.imei);
  const serialNumber = getFirstNonBlankValue(
    details?.serialNumber,
    details?.serial_number
  );

  return [
    { label: 'IMEI', value: imei },
    { label: 'S/N', value: serialNumber },
  ].filter((row) => row.value.length > 0);
}
