export interface CheckoutPaymentMerchant {
  bank_account_number?: string | null;
  bank_code?: string | null;
  country?: string | null;
  paystack_subaccount_code?: string | null;
  feature_settings?: unknown;
}

export interface LaunchPaymentRequirement {
  id: 'bank_account' | 'payment_method';
  label: string;
  description: string;
  completed: boolean;
}

function readBooleanSetting(
  settings: unknown,
  key: string
): boolean | undefined {
  if (!settings || typeof settings !== 'object') return undefined;

  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readPaystackEnabled(settings: unknown): boolean | undefined {
  return readBooleanSetting(settings, 'paystack_enabled');
}

function readKorapayEnabled(settings: unknown): boolean | undefined {
  return readBooleanSetting(settings, 'korapay_enabled');
}

function readPayOnDeliveryEnabled(settings: unknown): boolean | undefined {
  return readBooleanSetting(settings, 'pay_on_delivery_enabled');
}

export function normalizePaymentCountryCode(
  country: string | null | undefined
): string | null {
  const trimmed = country?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export function isBaciPaystackSettlementCountry(
  country: string | null | undefined
): boolean {
  const normalizedCountry = normalizePaymentCountryCode(country);
  return normalizedCountry === null || normalizedCountry === 'NG';
}

export function isPaystackCheckoutAvailable(
  merchant: CheckoutPaymentMerchant | null | undefined
): boolean {
  if (!merchant) return false;
  if (!isBaciPaystackSettlementCountry(merchant.country)) return false;
  if (readPaystackEnabled(merchant.feature_settings) === false) return false;
  return Boolean(merchant.paystack_subaccount_code?.trim());
}

export function isKorapayCheckoutAvailable(
  merchant: CheckoutPaymentMerchant | null | undefined
): boolean {
  if (!merchant) return false;
  return readKorapayEnabled(merchant.feature_settings) === true;
}

export function isPayOnDeliveryCheckoutAvailable(
  merchant: CheckoutPaymentMerchant | null | undefined
): boolean {
  if (!merchant) return false;
  return readPayOnDeliveryEnabled(merchant.feature_settings) === true;
}

// Bank transfer checkout currently provisions a Paystack DVA, so it must track
// the same availability gate until we add a separate bank-transfer capability.
export function isBankTransferCheckoutAvailable(
  merchant: CheckoutPaymentMerchant | null | undefined
): boolean {
  return isPaystackCheckoutAvailable(merchant);
}

export function hasPaystackSettlementDetails(
  merchant: CheckoutPaymentMerchant | null | undefined
): boolean {
  if (!merchant) return false;
  return Boolean(
    isPaystackCheckoutAvailable(merchant) &&
      merchant.bank_account_number?.trim() &&
      merchant.bank_code?.trim()
  );
}

export function hasLaunchablePaymentMethod(
  merchant: CheckoutPaymentMerchant | null | undefined
): boolean {
  return (
    hasPaystackSettlementDetails(merchant) ||
    isPayOnDeliveryCheckoutAvailable(merchant)
  );
}

export function requiresNigerianKycForLaunch(
  merchant: CheckoutPaymentMerchant | null | undefined
): boolean {
  if (!merchant) return false;
  if (hasPaystackSettlementDetails(merchant)) return true;
  return isBaciPaystackSettlementCountry(merchant.country);
}

export function getLaunchPaymentRequirement(
  merchant: CheckoutPaymentMerchant | null | undefined
): LaunchPaymentRequirement {
  if (hasPaystackSettlementDetails(merchant)) {
    return {
      id: 'bank_account',
      label: 'Add bank account',
      description: 'Required to receive payments via Paystack',
      completed: true,
    };
  }

  if (isPayOnDeliveryCheckoutAvailable(merchant)) {
    return {
      id: 'payment_method',
      label: 'Enable a payment method',
      description: 'Pay on Delivery is enabled for customer checkout',
      completed: true,
    };
  }

  if (!merchant || isBaciPaystackSettlementCountry(merchant.country)) {
    return {
      id: 'bank_account',
      label: 'Add bank account',
      description: 'Required to receive payments via Paystack',
      completed: false,
    };
  }

  return {
    id: 'payment_method',
    label: 'Enable a payment method',
    description: 'Enable Pay on Delivery or request an online payment provider',
    completed: false,
  };
}
