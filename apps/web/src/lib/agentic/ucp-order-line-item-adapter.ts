type JsonRecord = Record<string, unknown>;

export function mapUcpOrderLineItem(
  orderItem: unknown,
  index: number,
  orderShippingStatus: string | null
) {
  const orderItemRecord = isRecord(orderItem) ? orderItem : {};
  const quantity = toPositiveInteger(orderItemRecord.quantity) ?? 1;
  const fulfilled = getFulfilledQuantity(
    orderItemRecord,
    quantity,
    orderShippingStatus
  );
  const rawPrice = Math.max(0, toIntegerAmount(orderItemRecord.price) ?? 0);
  const total = Math.max(
    0,
    toIntegerAmount(orderItemRecord.line_extension_amount) ??
      rawPrice * quantity
  );
  const price =
    quantity > 0 ? Math.max(0, Math.round(total / quantity)) : rawPrice;
  const itemId =
    toStringValue(orderItemRecord.variant_id) ??
    toStringValue(orderItemRecord.product_id) ??
    toStringValue(orderItemRecord.id) ??
    `line_${index + 1}`;

  return {
    id: toStringValue(orderItemRecord.id) ?? `line_${index + 1}`,
    item: {
      id: itemId,
      price,
      title: toStringValue(orderItemRecord.name) ?? 'Unknown item',
    },
    quantity: {
      fulfilled,
      total: quantity,
    },
    status: getLineItemStatus(quantity, fulfilled),
    totals: [
      {
        amount: total,
        display_text: 'Total',
        type: 'total',
      },
    ],
  };
}

function getFulfilledQuantity(
  orderItemRecord: JsonRecord,
  total: number,
  orderShippingStatus: string | null
) {
  const fulfillmentData = getRecord(orderItemRecord.fulfillment_data);
  const explicitFulfilled = fulfillmentData
    ? toIntegerAmount(
        fulfillmentData.fulfilled_quantity ??
          fulfillmentData.fulfilledQuantity ??
          fulfillmentData.quantity_fulfilled
      )
    : null;
  if (explicitFulfilled !== null) {
    return Math.max(0, Math.min(total, explicitFulfilled));
  }
  return ['completed', 'delivered', 'shipped'].includes(
    (orderShippingStatus ?? '').toLowerCase()
  )
    ? total
    : 0;
}

function getLineItemStatus(total: number, fulfilled: number) {
  if (total <= 0) return 'removed';
  if (fulfilled >= total) return 'fulfilled';
  if (fulfilled > 0) return 'partial';
  return 'processing';
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function toIntegerAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function toPositiveInteger(value: unknown): number | null {
  const amount = toIntegerAmount(value);
  return amount && amount > 0 ? amount : null;
}
