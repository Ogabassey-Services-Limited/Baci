import type { CheckoutOrderItem } from '@/lib/checkout/build-order-items';

export interface CreditDirectLineItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

/**
 * Map canonical checkout order items to the line-item shape that
 * `openCreditDirectCheckout` (and the proportional allocator behind it)
 * expects.
 *
 * Credit Direct's allocation weights each product by `price * quantity`, so the
 * price MUST be the canonical checkout price produced by
 * `buildCheckoutOrderItems` — negotiated price applied, and 0 for a quiz-voucher
 * item — never the raw cart/display price. Feeding display prices here would
 * finance a voucher-covered item (canonical price 0) and under-allocate a paid
 * item, even though the aggregate still matches the signed total.
 */
export function toCreditDirectItems(
  orderItems: Pick<
    CheckoutOrderItem,
    'product_id' | 'name' | 'price' | 'quantity'
  >[]
): CreditDirectLineItem[] {
  return orderItems.map((item) => ({
    id: item.product_id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  }));
}
