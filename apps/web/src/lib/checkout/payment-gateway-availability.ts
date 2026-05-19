export interface CheckoutPaymentMerchant {
  paystack_subaccount_code?: string | null;
  feature_settings?: unknown;
}

function readPaystackEnabled(settings: unknown): boolean | undefined {
  if (!settings || typeof settings !== 'object') return undefined;

  const value = (settings as { paystack_enabled?: unknown }).paystack_enabled;
  return typeof value === 'boolean' ? value : undefined;
}

function readKorapayEnabled(settings: unknown): boolean | undefined {
  if (!settings || typeof settings !== 'object') return undefined;

  const value = (settings as { korapay_enabled?: unknown }).korapay_enabled;
  return typeof value === 'boolean' ? value : undefined;
}

export function isPaystackCheckoutAvailable(
  merchant: CheckoutPaymentMerchant | null | undefined
): boolean {
  if (!merchant) return false;
  if (readPaystackEnabled(merchant.feature_settings) === false) return false;
  return Boolean(merchant.paystack_subaccount_code?.trim());
}

export function isKorapayCheckoutAvailable(
  merchant: CheckoutPaymentMerchant | null | undefined
): boolean {
  if (!merchant) return false;
  return readKorapayEnabled(merchant.feature_settings) !== false;
}

// Bank transfer checkout currently provisions a Paystack DVA, so it must track
// the same availability gate until we add a separate bank-transfer capability.
export function isBankTransferCheckoutAvailable(
  merchant: CheckoutPaymentMerchant | null | undefined
): boolean {
  return isPaystackCheckoutAvailable(merchant);
}
