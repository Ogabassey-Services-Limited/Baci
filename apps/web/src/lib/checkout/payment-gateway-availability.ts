export interface CheckoutPaymentMerchant {
  bank_account_number?: string | null;
  bank_code?: string | null;
  country?: string | null;
  paystack_subaccount_code?: string | null;
  /**
   * Derived capability hint from the public merchant snapshot. The raw
   * subaccount code never crosses the anonymous boundary, so storefront
   * merchants carry this boolean instead.
   */
  paystack_subaccount_configured?: boolean | null;
  feature_settings?: unknown;
}

export interface LaunchPaymentRequirement {
  id: 'bank_account' | 'payment_method';
  label: string;
  description: string;
  completed: boolean;
}

// Single source of truth for the countries Baci's own Korapay account serves,
// mapped to the currency Korapay settles for each. Mirrors (and is consumed by)
// `getCurrencyFromCountry` in `@/lib/korapay` so the two never drift.
export const KORAPAY_SUPPORTED_COUNTRY_CURRENCIES = {
  NG: 'NGN',
  KE: 'KES',
  GH: 'GHS',
  ZA: 'ZAR',
  CM: 'XAF',
  CI: 'XOF',
  SN: 'XOF',
  BF: 'XOF',
} as const satisfies Record<string, string>;

export type KorapaySupportedCountry =
  keyof typeof KORAPAY_SUPPORTED_COUNTRY_CURRENCIES;

export type KorapaySupportedCurrency =
  (typeof KORAPAY_SUPPORTED_COUNTRY_CURRENCIES)[KorapaySupportedCountry];

const KORAPAY_CHECKOUT_CURRENCIES = new Set<string>(
  Object.values(KORAPAY_SUPPORTED_COUNTRY_CURRENCIES)
);

function readBooleanSetting(
  settings: unknown,
  key: string
): boolean | undefined {
  const normalizedSettings = Array.isArray(settings) ? settings[0] : settings;
  if (
    !normalizedSettings ||
    typeof normalizedSettings !== 'object' ||
    Array.isArray(normalizedSettings)
  ) {
    return undefined;
  }

  const value = (normalizedSettings as Record<string, unknown>)[key];
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

function readWalletPaystackDvaEnabled(settings: unknown): boolean | undefined {
  return readBooleanSetting(settings, 'wallet_paystack_dva_enabled');
}

function normalizePaymentCountryCode(
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
  return (
    Boolean(merchant.paystack_subaccount_code?.trim()) ||
    merchant.paystack_subaccount_configured === true
  );
}

export function isKorapayCheckoutCurrencySupported(
  currency: string | null | undefined
): boolean {
  const normalizedCurrency = currency?.trim().toUpperCase();
  return Boolean(
    normalizedCurrency && KORAPAY_CHECKOUT_CURRENCIES.has(normalizedCurrency)
  );
}

// Resolve the Korapay settlement currency for a merchant country. Country
// null/undefined fails open toward NG (the same convention
// `isBaciPaystackSettlementCountry` uses) so existing NG merchants with an unset
// country keep working checkout. Countries Korapay does not serve resolve to
// null and gate the provider off.
export function getKorapaySettlementCurrency(
  country: string | null | undefined
): KorapaySupportedCurrency | null {
  const normalizedCountry = normalizePaymentCountryCode(country) ?? 'NG';
  return (
    KORAPAY_SUPPORTED_COUNTRY_CURRENCIES[
      normalizedCountry as KorapaySupportedCountry
    ] ?? null
  );
}

// Whether a merchant country's Korapay settlement currency matches the order
// currency, ignoring the per-merchant enable flag. Country null/undefined fails
// open toward NG (→ NGN), matching `isBaciPaystackSettlementCountry`. A
// null/undefined currency only asserts the country is served at all. Shared by
// `isKorapayCheckoutAvailable` (the client-forced path) and the initialize
// route's `selectGateway`/downstream guard (the auto-select path) so both agree
// on when Korapay can actually settle an order.
export function isKorapaySettlementCurrencyMatch(
  country: string | null | undefined,
  currency: string | null | undefined
): boolean {
  const settlementCurrency = getKorapaySettlementCurrency(country);
  if (settlementCurrency === null) return false;

  if (currency == null) return true;

  return currency.trim().toUpperCase() === settlementCurrency;
}

export function isKorapayCheckoutAvailable(
  merchant: CheckoutPaymentMerchant | null | undefined,
  country?: string | null,
  currency?: string | null
): boolean {
  if (!merchant) return false;
  if (readKorapayEnabled(merchant.feature_settings) === false) return false;

  return isKorapaySettlementCurrencyMatch(country, currency);
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
  if (!isPaystackCheckoutAvailable(merchant)) return false;
  return readWalletPaystackDvaEnabled(merchant?.feature_settings) === true;
}

// Gateways a storefront checkout can force via the initialize route's `gateway`
// field. MUST stay in sync with PAYMENT_GATEWAYS in
// `app/api/payments/initialize/route.ts`.
export type ForcedCheckoutGateway =
  | 'paystack'
  | 'korapay'
  | 'juicyway'
  | 'credit_direct'
  | 'credpal'
  | 'klump';

function readCreditDirectEnabled(settings: unknown): boolean | undefined {
  return readBooleanSetting(settings, 'credit_direct_enabled');
}

function readCredpalEnabled(settings: unknown): boolean | undefined {
  return readBooleanSetting(settings, 'credpal_enabled');
}

function readKlumpEnabled(settings: unknown): boolean | undefined {
  return readBooleanSetting(settings, 'klump_enabled');
}

// Validate a client-FORCED checkout gateway against the merchant's actual
// availability (connected + enabled + currency) rather than mere membership in
// the allowed-gateway list. The storefront may bypass server-side gateway
// selection by passing an explicit `gateway`; without this guard any client
// could force any listed gateway regardless of merchant configuration — a
// money-path hole (e.g. forcing a BNPL gateway the merchant never enabled).
// Centralizes the per-gateway checks that were otherwise scattered as ad-hoc
// guards in the initialize route.
//
// `juicyway` has no per-merchant availability toggle — it is gated at the
// platform level by the JUICYWAY_SECRET_KEY env inside the route — so it passes
// this merchant-availability gate and is validated downstream.
export function isForcedGatewayAvailable(
  gateway: ForcedCheckoutGateway,
  merchant: CheckoutPaymentMerchant | null | undefined,
  currency: string | null | undefined
): boolean {
  switch (gateway) {
    case 'paystack':
      return isPaystackCheckoutAvailable(merchant);
    case 'korapay':
      return isKorapayCheckoutAvailable(merchant, merchant?.country, currency);
    case 'credit_direct':
      return readCreditDirectEnabled(merchant?.feature_settings) === true;
    case 'credpal':
      return readCredpalEnabled(merchant?.feature_settings) === true;
    case 'klump':
      return readKlumpEnabled(merchant?.feature_settings) === true;
    case 'juicyway':
      return true;
    default:
      return false;
  }
}

function hasPaystackSettlementDetails(
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
