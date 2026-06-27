import type { OrderItem } from '@/components/orders/new-order.types';
import { formatCurrency, getCurrencySymbol } from './utils';

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
      return formatCurrency(amount, undefined, merchantCurrency || undefined);
    } catch {
      const symbol = getCurrencySymbol(merchantCurrency || undefined);
      return `${symbol}${amount.toFixed(2)}`;
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
