import type { ReceiptMerchant, ReceiptOrder } from './types';

const CURRENCY_LOCALE_MAP: Record<string, string> = {
  NGN: 'en-NG',
  GHS: 'en-GH',
  KES: 'en-KE',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  ZAR: 'en-ZA',
  XAF: 'fr-CM',
  XOF: 'fr-SN',
};

const MONEY_TOLERANCE = 0.01;
export const DEFAULT_NG_VAT_RATE = 7.5;

export type MoneyFormatter = (amount: number) => string;

export function createMoneyFormatter(currencyCode: string): MoneyFormatter {
  const locale = CURRENCY_LOCALE_MAP[currencyCode] || 'en-NG';
  return (amount) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
}

export function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const r = Number.parseInt(cleaned.substring(0, 2), 16);
  const g = Number.parseInt(cleaned.substring(2, 4), 16);
  const b = Number.parseInt(cleaned.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(26, 26, 46, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getStoredAmountPrecision(amount: number): number {
  const [, fraction = ''] = Math.abs(amount).toString().split('.');
  return fraction.replace(/0+$/, '').length;
}

function roundToPrecision(amount: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(amount * scale) / scale;
}

function storedAmountMatchesComputed(
  storedAmount: number,
  computedAmount: number
): boolean {
  const precision = getStoredAmountPrecision(storedAmount);
  return (
    roundToPrecision(storedAmount, precision) ===
    roundToPrecision(computedAmount, precision)
  );
}

function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= MONEY_TOLERANCE;
}

function getTaxExclusiveTotal(order: ReceiptOrder): number {
  return order.subtotal - order.discount_amount + order.shipping_fee;
}

function getIncludedTaxAmount(total: number, taxRate: number): number {
  return total - total / (1 + taxRate / 100);
}

function getDefaultVatRateForCurrency(currencyCode: string): number | null {
  const locale = CURRENCY_LOCALE_MAP[currencyCode.toUpperCase()];
  return locale === 'en-NG' ? DEFAULT_NG_VAT_RATE : null;
}

export function getReceiptVatRate(
  merchant: ReceiptMerchant,
  currencyCode: string
): number | null {
  const vatRate = merchant.vat_rate;
  if (vatRate === null) {
    return getDefaultVatRateForCurrency(currencyCode);
  }

  if (
    typeof vatRate !== 'number' ||
    !Number.isFinite(vatRate) ||
    vatRate <= 0
  ) {
    return null;
  }

  return vatRate;
}

function isTaxExclusiveTotal(order: ReceiptOrder): boolean {
  return almostEqual(
    order.total,
    getTaxExclusiveTotal(order) + order.tax_amount
  );
}

function isTaxInclusiveTotal(
  order: ReceiptOrder,
  merchant: ReceiptMerchant
): boolean {
  const vatRate = getReceiptVatRate(merchant, order.currency);
  if (vatRate === null) {
    return false;
  }

  return (
    almostEqual(order.total, getTaxExclusiveTotal(order)) &&
    storedAmountMatchesComputed(
      order.tax_amount,
      getIncludedTaxAmount(order.total, vatRate)
    )
  );
}

export function shouldShowVatLine(
  order: ReceiptOrder,
  merchant: ReceiptMerchant
): boolean {
  if (
    merchant.vat_registration_status !== 'registered' ||
    order.tax_amount <= 0
  ) {
    return false;
  }

  return isTaxExclusiveTotal(order) || isTaxInclusiveTotal(order, merchant);
}

export function getReceiptDisplaySubtotal(
  order: ReceiptOrder,
  merchant: ReceiptMerchant
): number {
  if (
    !shouldShowVatLine(order, merchant) ||
    !isTaxInclusiveTotal(order, merchant)
  ) {
    return order.subtotal;
  }

  const displaySubtotal =
    order.total - order.tax_amount - order.shipping_fee + order.discount_amount;
  return displaySubtotal >= 0 ? displaySubtotal : order.subtotal;
}
