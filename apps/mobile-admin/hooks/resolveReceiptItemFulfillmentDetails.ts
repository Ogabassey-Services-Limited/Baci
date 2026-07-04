import {
  type ReceiptFulfillmentDetails,
  resolveReceiptItemFulfillmentDetails as resolveSharedReceiptItemFulfillmentDetails,
} from '@baci/shared';
import type {
  OrderDetailsItem,
  OrderDetailsRecord,
} from '@/components/orders/order-details.types';

export function resolveReceiptItemFulfillmentDetails(
  details: OrderDetailsRecord['fulfillment_details'],
  item: OrderDetailsItem
): ReceiptFulfillmentDetails | null {
  return resolveSharedReceiptItemFulfillmentDetails(details, item);
}
