import { unknownValueGuards } from '@/lib/unknown-value-guards';
import type { getStoredCheckoutPaymentSnapshot } from './checkout-completion-response';
import {
  getFulfillmentAmount,
  getSubtotalAmount,
  getTotalAmount,
} from './checkout-storage';

type CheckoutPaymentSnapshot = NonNullable<
  ReturnType<typeof getStoredCheckoutPaymentSnapshot>
>;
const { isRecord, nonEmptyString } = unknownValueGuards;

export function validateAgenticDvaCutoverSnapshot(
  record: Record<string, unknown>,
  snapshot: CheckoutPaymentSnapshot
): string | null {
  if (!hasValidPaymentSnapshot(snapshot)) return 'payment_snapshot_invalid';
  if (!matchesCartSnapshot(record.cart_items, snapshot)) {
    return 'cart_snapshot_mismatch';
  }
  if (
    !matchesAmount(record.subtotal, getSubtotalAmount(snapshot.totals)) ||
    !matchesAmount(
      record.shipping_cost,
      getFulfillmentAmount(snapshot.totals)
    ) ||
    !matchesAmount(record.total_amount, getTotalAmount(snapshot.totals))
  ) {
    return 'amount_snapshot_mismatch';
  }
  return null;
}

function hasValidPaymentSnapshot(snapshot: CheckoutPaymentSnapshot): boolean {
  const totalEntries = snapshot.totals.filter(
    (candidate) => candidate.type === 'total'
  );
  const total = totalEntries[0];
  const amount = Number(total?.amount);
  return (
    snapshot.lineItems.length > 0 &&
    snapshot.lineItems.every(
      (lineItem) =>
        lineItem.item.id.trim().length > 0 &&
        lineItem.item.product_id.trim().length > 0 &&
        Number.isFinite(lineItem.total) &&
        lineItem.total >= 0 &&
        Number.isInteger(lineItem.item.quantity) &&
        lineItem.item.quantity > 0
    ) &&
    getSubtotalAmount(snapshot.totals) > 0 &&
    totalEntries.length === 1 &&
    Number.isFinite(amount) &&
    amount > 0
  );
}

function matchesAmount(value: unknown, expected: number): boolean {
  if (value === null || value === undefined || value === '') return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount === expected;
}

function matchesCartSnapshot(
  cartItems: unknown,
  snapshot: CheckoutPaymentSnapshot
): boolean {
  if (
    !Array.isArray(cartItems) ||
    cartItems.length !== snapshot.lineItems.length
  ) {
    return false;
  }
  const storedCart = cartItems.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = nonEmptyString(item.id);
    const quantity = Number(item.quantity);
    return id && Number.isInteger(quantity) && quantity > 0
      ? [{ id, quantity }]
      : [];
  });
  if (storedCart.length !== cartItems.length) return false;
  const snapshotCart = snapshot.lineItems.map((lineItem) => ({
    id: lineItem.item.id,
    quantity: lineItem.item.quantity,
  }));
  return serializeCart(storedCart) === serializeCart(snapshotCart);
}

function serializeCart(items: Array<{ id: string; quantity: number }>): string {
  return JSON.stringify(
    items
      .map(({ id, quantity }) => `${id}:${quantity}`)
      .sort((left, right) => left.localeCompare(right))
  );
}
