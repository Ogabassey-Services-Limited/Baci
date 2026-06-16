import type { PaymentMethod } from '../types';
import { isGatewayAmountDifferentFromOrderTotal } from '../utils';

const DEFAULT_KLUMP_MIN_AMOUNT = 10_000;
const DEFAULT_KLUMP_MAX_AMOUNT = 1_000_000;
// Mirrors the server-side BNPL bounds enforced by /api/payments/credit-direct/sign
// so the UI never offers Credit Direct for an amount the gateway will reject.
const DEFAULT_CREDIT_DIRECT_MIN_AMOUNT = 5_000;
const DEFAULT_CREDIT_DIRECT_MAX_AMOUNT = 5_000_000;

export interface FeatureSettings {
  paystack_enabled?: boolean;
  korapay_enabled?: boolean;
  juicyway_enabled?: boolean;
  pay_on_delivery_enabled?: boolean;
  credpal_enabled?: boolean;
  credit_direct_enabled?: boolean;
  credit_direct_min_amount?: number | string | null;
  credit_direct_max_amount?: number | string | null;
  klump_enabled?: boolean;
  klump_min_amount?: number | string | null;
  klump_max_amount?: number | string | null;
}

function toAmountLimit(
  value: number | string | null | undefined,
  fallback: number,
): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return fallback;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function isKlumpEligible({
  featureSettings,
  currency,
  orderAmount,
  payableAmount,
}: {
  featureSettings?: FeatureSettings | null;
  currency?: string | null;
  orderAmount: number;
  payableAmount: number;
}): boolean {
  if (featureSettings?.klump_enabled !== true) {
    return false;
  }

  const normalizedCurrency = typeof currency === 'string' ? currency : '';
  if (normalizedCurrency.trim().toUpperCase() !== 'NGN') {
    return false;
  }

  if (isGatewayAmountDifferentFromOrderTotal(payableAmount, orderAmount)) {
    return false;
  }

  const minAmount = toAmountLimit(
    featureSettings.klump_min_amount,
    DEFAULT_KLUMP_MIN_AMOUNT,
  );
  const maxAmount = toAmountLimit(
    featureSettings.klump_max_amount,
    DEFAULT_KLUMP_MAX_AMOUNT,
  );

  return payableAmount >= minAmount && payableAmount <= maxAmount;
}

export function isCreditDirectEligible({
  featureSettings,
  currency,
  orderAmount,
  payableAmount,
}: {
  featureSettings?: FeatureSettings | null;
  currency?: string | null;
  orderAmount: number;
  payableAmount: number;
}): boolean {
  if (featureSettings?.credit_direct_enabled !== true) {
    return false;
  }

  const normalizedCurrency = typeof currency === 'string' ? currency : '';
  if (normalizedCurrency.trim().toUpperCase() !== 'NGN') {
    return false;
  }

  if (isGatewayAmountDifferentFromOrderTotal(payableAmount, orderAmount)) {
    return false;
  }

  const minAmount = toAmountLimit(
    featureSettings.credit_direct_min_amount,
    DEFAULT_CREDIT_DIRECT_MIN_AMOUNT,
  );
  const maxAmount = toAmountLimit(
    featureSettings.credit_direct_max_amount,
    DEFAULT_CREDIT_DIRECT_MAX_AMOUNT,
  );

  return payableAmount >= minAmount && payableAmount <= maxAmount;
}

export function isPaymentMethodAvailable({
  paymentMethod,
  paystackCheckoutAvailable,
  korapayCheckoutAvailable,
  bankTransferCheckoutAvailable,
  featureSettings,
  currency,
  orderAmount,
  payableAmount,
}: {
  paymentMethod: PaymentMethod;
  paystackCheckoutAvailable: boolean;
  korapayCheckoutAvailable: boolean;
  bankTransferCheckoutAvailable: boolean;
  featureSettings?: FeatureSettings | null;
  currency?: string | null;
  orderAmount: number;
  payableAmount: number;
}): boolean {
  switch (paymentMethod) {
    case 'paystack':
      return paystackCheckoutAvailable;
    case 'bank_transfer':
      return bankTransferCheckoutAvailable;
    case 'korapay':
      return korapayCheckoutAvailable;
    case 'juicyway':
      return featureSettings?.juicyway_enabled === true;
    case 'pod':
      return featureSettings?.pay_on_delivery_enabled === true;
    case 'credpal':
      return featureSettings?.credpal_enabled === true;
    case 'credit_direct':
      return isCreditDirectEligible({
        featureSettings,
        currency,
        orderAmount,
        payableAmount,
      });
    case 'klump':
      return isKlumpEligible({
        featureSettings,
        currency,
        orderAmount,
        payableAmount,
      });
    case 'invoice':
    case 'payforme':
      return true;
    case '':
    default:
      return false;
  }
}

export function hasAnyInstallmentOption({
  featureSettings,
  currency,
  orderAmount,
  payableAmount,
}: {
  featureSettings?: FeatureSettings | null;
  currency?: string | null;
  orderAmount: number;
  payableAmount: number;
}): boolean {
  return Boolean(
    featureSettings?.credpal_enabled ||
      isCreditDirectEligible({
        featureSettings,
        currency,
        orderAmount,
        payableAmount,
      }) ||
      isKlumpEligible({
        featureSettings,
        currency,
        orderAmount,
        payableAmount,
      }),
  );
}
