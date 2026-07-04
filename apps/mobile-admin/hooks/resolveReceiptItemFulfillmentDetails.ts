import type { ReceiptFulfillmentDetails } from '@baci/shared';
import { getFirstNonBlankString } from '@baci/shared';
import type {
  OrderDetailsItem,
  OrderDetailsRecord,
} from '@/components/orders/order-details.types';

type FulfillmentItemEntry = NonNullable<
  NonNullable<OrderDetailsRecord['fulfillment_details']>['items']
>[number];

function getUniqueJoinedIdentifiers(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).join(', ');
}

function fulfillmentEntryMatchesOrderItem(
  entry: FulfillmentItemEntry,
  item: OrderDetailsItem
) {
  const entryId = getFirstNonBlankString(entry.id);
  if (entryId === item.id || entryId.startsWith(`${item.id}:`)) {
    return true;
  }

  const orderItemId = getFirstNonBlankString(
    entry.orderItemId,
    entry.order_item_id
  );
  if (orderItemId === item.id) {
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

export function resolveReceiptItemFulfillmentDetails(
  details: OrderDetailsRecord['fulfillment_details'],
  item: OrderDetailsItem
): ReceiptFulfillmentDetails | null {
  const matchingItems = (details?.items ?? []).filter((entry) =>
    fulfillmentEntryMatchesOrderItem(entry, item)
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
