import type { OrderItem } from '@/components/orders/new-order.types';

export interface NewOrderTotalsParams {
  discount: number;
  isVatApplied: boolean;
  merchantCurrency?: string | null;
  merchantVatRate?: number | null;
  orderItems: OrderItem[];
  shippingFee: number;
  taxes: number;
}

export function createNewOrderTotals({
  discount,
  isVatApplied,
  merchantCurrency,
  merchantVatRate,
  orderItems,
  shippingFee,
  taxes,
}: NewOrderTotalsParams) {
  const formatPrice = (amount: number) => {
    try {
      return new Intl.NumberFormat('en-NG', {
        currency: merchantCurrency || 'NGN',
        minimumFractionDigits: 2,
        style: 'currency',
      }).format(amount);
    } catch {
      return `₦${amount.toFixed(2)}`;
    }
  };

  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const vatRate = (merchantVatRate ?? 7.5) / 100;
  const calculatedVat =
    Math.round(Math.max(0, subtotal - discount) * vatRate * 100) / 100;
  const taxesToUse = isVatApplied ? calculatedVat : taxes;
  const total = subtotal - discount + shippingFee + taxesToUse;

  return {
    calculatedVat,
    formatPrice,
    subtotal,
    taxesToUse,
    total,
    vatRate,
  };
}
