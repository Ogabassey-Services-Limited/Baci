import { normalizeComparableProductName } from '@/lib/product-matching';

interface MergeableOrderItem {
  product_id: string;
  quantity: number;
  name: string;
  price: number;
  is_custom?: boolean;
}

function getCustomItemKey(item: Pick<MergeableOrderItem, 'name' | 'price'>) {
  const normalizedName = normalizeComparableProductName(item.name);
  const normalizedPrice = Number(item.price).toFixed(2);

  return `${normalizedName}:${normalizedPrice}`;
}

export function mergeOrderItem<T extends MergeableOrderItem>(
  orderItems: T[],
  nextItem: T
): T[] {
  const existingIndex = nextItem.is_custom
    ? orderItems.findIndex(
        (item) =>
          item.is_custom &&
          getCustomItemKey(item) === getCustomItemKey(nextItem)
      )
    : orderItems.findIndex((item) => item.product_id === nextItem.product_id);

  if (existingIndex === -1) {
    return [...orderItems, nextItem];
  }

  return orderItems.map((item, index) =>
    index === existingIndex
      ? { ...item, quantity: item.quantity + nextItem.quantity }
      : item
  );
}
