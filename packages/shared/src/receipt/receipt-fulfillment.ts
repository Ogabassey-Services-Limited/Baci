import { getFirstNonBlankString } from '../lib/string-values';
import type { ReceiptFulfillmentDetails, ReceiptOrder } from './types';

const DEVICE_RECEIPT_ITEM_NAME_PATTERN =
  /\b(?:iphone|samsung|pixel|galaxy|ipad|xiaomi|redmi|infinix|tecno|macbook)\b/i;

export interface ReceiptFulfillmentRow {
  label: string;
  value: string;
}

function getRecordString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

export function isDeviceReceiptItemName(name: string): boolean {
  return DEVICE_RECEIPT_ITEM_NAME_PATTERN.test(name);
}

export function normalizeReceiptFulfillmentDetails(
  value: unknown
): ReceiptFulfillmentDetails | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const imei = getFirstNonBlankString(getRecordString(record, 'imei'));
  const serialNumber = getFirstNonBlankString(
    getRecordString(record, 'serialNumber'),
    getRecordString(record, 'serial_number')
  );

  if (!imei && !serialNumber) {
    return null;
  }

  return {
    imei: imei || null,
    serialNumber: serialNumber || null,
  };
}

export function getReceiptFulfillmentSummary(
  details: ReceiptFulfillmentDetails | null | undefined
): string | null {
  const imei = getFirstNonBlankString(details?.imei);
  const serialNumber = getFirstNonBlankString(
    details?.serialNumber,
    details?.serial_number
  );
  const parts = [];
  if (imei) parts.push(`IMEI: ${imei}`);
  if (serialNumber) parts.push(`S/N: ${serialNumber}`);

  return parts.length > 0 ? parts.join(' | ') : null;
}

export function shouldAttachFulfillmentToItem({
  hasDeviceItem,
  index,
  itemName,
}: {
  hasDeviceItem: boolean;
  index: number;
  itemName: string;
}): boolean {
  return isDeviceReceiptItemName(itemName) || (!hasDeviceItem && index === 0);
}

export function appendReceiptFulfillmentDescription({
  description,
  fulfillment,
  hasDeviceItem,
  index,
  itemName,
}: {
  description?: string;
  fulfillment: ReceiptFulfillmentDetails | null;
  hasDeviceItem: boolean;
  index: number;
  itemName: string;
}): string | undefined {
  const summary = getReceiptFulfillmentSummary(fulfillment);
  if (!summary) {
    return description;
  }

  if (!shouldAttachFulfillmentToItem({ hasDeviceItem, index, itemName })) {
    return description;
  }

  return description ? `${description}\n${summary}` : summary;
}

export function getReceiptFulfillmentRows(
  order: ReceiptOrder
): ReceiptFulfillmentRow[] {
  return getReceiptFulfillmentRowsFromDetails(order.fulfillment_details);
}

export function getReceiptFulfillmentRowsFromDetails(
  details: ReceiptFulfillmentDetails | null | undefined
): ReceiptFulfillmentRow[] {
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
