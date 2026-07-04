import { getFirstNonBlankString } from '../lib/string-values';
import type { ReceiptFulfillmentDetails, ReceiptOrder } from './types';

const DEVICE_RECEIPT_ITEM_NAME_PATTERN =
  /\b(?:iphone|samsung|pixel|galaxy|ipad|xiaomi|redmi|infinix|tecno|macbook)\b/i;

export interface ReceiptFulfillmentRow {
  label: string;
  value: string;
}

interface ReceiptFulfillmentMatchItem {
  id?: string | number | null;
  line_id?: string | number | null;
  name?: string | null;
  product_name?: string | null;
  variant_name?: string | null;
}

type NormalizedReceiptFulfillmentItem = NonNullable<
  ReceiptFulfillmentDetails['items']
>[number];

function getRecordString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function getNormalizedFulfillmentItems(
  record: Record<string, unknown>
): NormalizedReceiptFulfillmentItem[] {
  const items = record.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items.reduce<NormalizedReceiptFulfillmentItem[]>((result, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return result;
    }

    const itemRecord = item as Record<string, unknown>;
    const imei = getFirstNonBlankString(getRecordString(itemRecord, 'imei'));
    const serialNumber = getFirstNonBlankString(
      getRecordString(itemRecord, 'serialNumber'),
      getRecordString(itemRecord, 'serial_number')
    );

    if (!imei && !serialNumber) {
      return result;
    }

    result.push({
      id: getFirstNonBlankString(getRecordString(itemRecord, 'id')) || null,
      imei: imei || null,
      orderItemId:
        getFirstNonBlankString(
          getRecordString(itemRecord, 'orderItemId'),
          getRecordString(itemRecord, 'order_item_id')
        ) || null,
      productName:
        getFirstNonBlankString(
          getRecordString(itemRecord, 'productName'),
          getRecordString(itemRecord, 'product_name')
        ) || null,
      serialNumber: serialNumber || null,
      variantName:
        getFirstNonBlankString(
          getRecordString(itemRecord, 'variantName'),
          getRecordString(itemRecord, 'variant_name')
        ) || null,
    });
    return result;
  }, []);
}

function getUniqueJoinedIdentifiers(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).join(', ');
}

function normalizeMatchValue(value: string | number | null | undefined) {
  return value == null ? '' : String(value).trim();
}

function fulfillmentEntryMatchesReceiptItem(
  entry: NormalizedReceiptFulfillmentItem,
  item: ReceiptFulfillmentMatchItem
) {
  const itemId = normalizeMatchValue(item.id);
  const entryId = getFirstNonBlankString(entry.id);
  if (itemId && (entryId === itemId || entryId.startsWith(`${itemId}:`))) {
    return true;
  }

  const orderItemId = getFirstNonBlankString(
    entry.orderItemId,
    entry.order_item_id
  );
  if (itemId && orderItemId === itemId) {
    return true;
  }

  const itemLineId = normalizeMatchValue(item.line_id);
  if (itemLineId && orderItemId === itemLineId) {
    return true;
  }

  const entryProductName = getFirstNonBlankString(
    entry.productName,
    entry.product_name
  ).toLowerCase();
  const itemProductName = getFirstNonBlankString(
    item.product_name,
    item.name
  ).toLowerCase();
  if (!entryProductName || entryProductName !== itemProductName) {
    return false;
  }

  const entryVariantName = getFirstNonBlankString(
    entry.variantName,
    entry.variant_name
  ).toLowerCase();
  const itemVariantName = getFirstNonBlankString(
    item.variant_name
  ).toLowerCase();
  if (!itemVariantName) {
    return !entryVariantName;
  }

  return entryVariantName === itemVariantName;
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
  const items = getNormalizedFulfillmentItems(record);

  if (!imei && !serialNumber && items.length === 0) {
    return null;
  }

  return {
    imei: imei || null,
    items: items.length > 0 ? items : undefined,
    serialNumber: serialNumber || null,
  };
}

export function resolveReceiptItemFulfillmentDetails(
  details: ReceiptFulfillmentDetails | null | undefined,
  item: ReceiptFulfillmentMatchItem
): ReceiptFulfillmentDetails | null {
  const matchingItems = (details?.items ?? []).filter((entry) =>
    fulfillmentEntryMatchesReceiptItem(entry, item)
  );
  if (matchingItems.length === 0) {
    return null;
  }

  const imei = getUniqueJoinedIdentifiers(
    matchingItems.map((entry) => getFirstNonBlankString(entry.imei))
  );
  const serialNumber = getUniqueJoinedIdentifiers(
    matchingItems.map((entry) =>
      getFirstNonBlankString(entry.serialNumber, entry.serial_number)
    )
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
