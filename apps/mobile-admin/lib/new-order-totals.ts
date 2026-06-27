import type { OrderItem } from '@/components/orders/new-order.types';
import { formatCurrency, getCurrencySymbol } from './utils';

const DEFAULT_ORDER_CURRENCY = 'NGN';
const DEFAULT_NGN_LOCALE = 'en-NG';

function normalizeMerchantCurrency(currency?: string | null): string {
  const normalized = currency?.trim().toUpperCase() || DEFAULT_ORDER_CURRENCY;

  try {
    new Intl.NumberFormat(undefined, {
      currency: normalized,
      style: 'currency',
    }).format(0);
    return normalized;
  } catch {
    return DEFAULT_ORDER_CURRENCY;
  }
}

function getOrderCurrencyLocale(currency: string): string | undefined {
  return currency === DEFAULT_ORDER_CURRENCY ? DEFAULT_NGN_LOCALE : undefined;
}

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
  const currency = normalizeMerchantCurrency(merchantCurrency);
  const locale = getOrderCurrencyLocale(currency);

  const formatPrice = (amount: number) => {
    try {
      return formatCurrency(amount, undefined, currency, locale);
    } catch {
      const symbol = getCurrencySymbol(
        DEFAULT_ORDER_CURRENCY,
        DEFAULT_NGN_LOCALE
      );
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
