import type { Order } from './actions';

export interface OrderDetailsItem {
  id: string;
  image?: string;
  name: string;
  variant?: string;
  quantity: number;
  price: number;
  product?: {
    image?: string;
    fulfillmentFields?: string[];
  };
  hasAssurance?: boolean;
}

function isFulfillmentProduct(
  value: unknown
): value is OrderDetailsItem['product'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (!('image' in value) && !('fulfillmentFields' in value)) {
    return false;
  }

  const candidate = value as {
    image?: unknown;
    fulfillmentFields?: unknown;
  };

  return (
    (candidate.image === undefined || typeof candidate.image === 'string') &&
    (candidate.fulfillmentFields === undefined ||
      (Array.isArray(candidate.fulfillmentFields) &&
        candidate.fulfillmentFields.every(
          (field) => typeof field === 'string'
        )))
  );
}

function isOrderDetailsItem(value: unknown): value is OrderDetailsItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    id?: unknown;
    image?: unknown;
    name?: unknown;
    variant?: unknown;
    quantity?: unknown;
    price?: unknown;
    product?: unknown;
    hasAssurance?: unknown;
  };

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    (candidate.variant === undefined ||
      typeof candidate.variant === 'string') &&
    typeof candidate.quantity === 'number' &&
    typeof candidate.price === 'number' &&
    (candidate.image === undefined || typeof candidate.image === 'string') &&
    (candidate.product === undefined ||
      isFulfillmentProduct(candidate.product)) &&
    (candidate.hasAssurance === undefined ||
      typeof candidate.hasAssurance === 'boolean')
  );
}

function parseOrderItems(items: unknown): OrderDetailsItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(isOrderDetailsItem);
}

export function getOrderItems(
  order: Pick<Order, 'items'> & { order_items?: unknown }
): OrderDetailsItem[] {
  const parsedItems = parseOrderItems(order.items);

  if (parsedItems.length > 0) {
    return parsedItems;
  }

  return parseOrderItems(order.order_items);
}
