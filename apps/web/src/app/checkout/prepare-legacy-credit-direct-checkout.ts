import type { CheckoutOrderItem } from '@/lib/checkout/build-order-items';
import { prepareCreditDirectAmounts } from '@/lib/credit-direct-products';

export function prepareLegacyCreditDirectCheckout(
  orderItems: Pick<
    CheckoutOrderItem,
    'product_id' | 'name' | 'price' | 'quantity'
  >[],
  totalAmount: number
) {
  return prepareCreditDirectAmounts(
    orderItems.map((item) => ({
      id: item.product_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
    totalAmount
  );
}
