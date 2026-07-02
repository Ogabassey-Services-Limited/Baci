import type { OrderItem } from '@/components/orders/new-order.types';
import {
  formatCurrency,
  getCurrencySymbol,
  normalizeMerchantCurrency,
} from './utils';

const DEFAULT_ORDER_TOTAL_LOCALE = 'en-US';

const ORDER_TOTAL_LOCALE_BY_CURRENCY: Record<string, string> = {
  CAD: 'en-CA',
  EUR: 'de-DE',
  GBP: 'en-GB',
  GHS: 'en-GH',
  KES: 'en-KE',
  NGN: 'en-NG',
  USD: 'en-US',
  XAF: 'fr-CM',
  XOF: 'fr-SN',
  ZAR: 'en-ZA',
};

function getOrderTotalLocale(currency: string): string {
  return ORDER_TOTAL_LOCALE_BY_CURRENCY[currency] ?? DEFAULT_ORDER_TOTAL_LOCALE;
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
  const normalizedCurrency = normalizeMerchantCurrency(merchantCurrency) || 'NGN';
  const orderTotalLocale = getOrderTotalLocale(normalizedCurrency);

  const formatPrice = (amount: number) => {
    try {
      return formatCurrency(
        amount,
        undefined,
        normalizedCurrency,
        orderTotalLocale
      );
    } catch {
      return `${getCurrencySymbol(
        normalizedCurrency,
        orderTotalLocale
      )}${amount.toFixed(2)}`;
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
