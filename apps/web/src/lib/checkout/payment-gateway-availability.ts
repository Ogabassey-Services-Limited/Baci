import { getCurrencyForCountry } from '@/lib/currency-utils';
import { isPaypalMerchantCountry } from '@/lib/payments/paypal-merchant-countries';
import { PAYPAL_SUPPORTED_CURRENCIES } from '@/lib/paypal/paypal-currency';

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
  // Precomputed by the caller (Wave 2, see
  // docs/payments/byok-payment-providers-plan.md Phase 2 item 10): whether
  // the merchant has PayPal enabled with a validated *live* vault credential
  // (`isPaypalConnectionValidForLaunch` in
  // lib/payments/paypal-launch-connection.ts). This module stays synchronous
  // and never talks to the credential vault itself — callers that need this
  // field (readiness/publish routes) fetch it once and pass it in, the same
  // way `feature_settings` is already threaded through.
  paypalConnected?: boolean;
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

// Reads a single value from `feature_settings.custom_settings` (a nested JSONB
// blob), where the non-secret PayPal toggles live (`paypal_enabled`,
// `paypal_mode`), rather than the top-level feature-settings columns the other
// readers use. Handles the same array-wrapped shape (edge SQL sometimes returns
// single joins as arrays).
function readCustomSetting(settings: unknown, key: string): unknown {
  const normalizedSettings = Array.isArray(settings) ? settings[0] : settings;
  if (
    !normalizedSettings ||
    typeof normalizedSettings !== 'object' ||
    Array.isArray(normalizedSettings)
  ) {
    return undefined;
  }

  const custom = (normalizedSettings as Record<string, unknown>)
    .custom_settings;
  const normalizedCustom = Array.isArray(custom) ? custom[0] : custom;
  if (
    !normalizedCustom ||
    typeof normalizedCustom !== 'object' ||
    Array.isArray(normalizedCustom)
  ) {
    return undefined;
  }

  return (normalizedCustom as Record<string, unknown>)[key];
}

// The customer-facing PayPal enable toggle. Lives in
// `merchant_feature_settings.custom_settings.paypal_enabled` (non-secret config;
// the credentials themselves are in the encrypted vault). Only the boolean is
// ever read here — never any other `custom_settings` key.
function readPaypalEnabled(settings: unknown): boolean | undefined {
  const value = readCustomSetting(settings, 'paypal_enabled');
  return typeof value === 'boolean' ? value : undefined;
}

// The customer-facing PayPal environment toggle
// (`custom_settings.paypal_mode`). Customer checkout is live-only — sandbox is
// reserved for the settings-page validate-on-save connection test — so the
// storefront gate treats anything but 'live' (including a missing mode) as off.
function isPaypalLiveMode(settings: unknown): boolean {
  return readCustomSetting(settings, 'paypal_mode') === 'live';
}

// The order currency Baci converts *from* when presenting a PayPal order in a
// PayPal-native currency (NGN orders are converted to USD by the create-order
// route's live-FX path — see paypal-create-order-helpers.ts).
const PAYPAL_FX_SOURCE_CURRENCY = 'NGN';

// Whether an order currency can be presented to PayPal: either a currency PayPal
// natively accepts (USD/EUR/GBP/...) or NGN via the route's fail-closed live-FX
// path. Kept consistent with what the create-order route actually accepts
// (`PAYPAL_SUPPORTED_CURRENCIES` + the NGN branch of `resolvePaypalPresentment`)
// so the storefront never offers PayPal for a currency the route would reject.
export function isPaypalPresentableCurrency(
  currency: string | null | undefined
): boolean {
  const normalized = currency?.trim().toUpperCase();
  if (!normalized) return false;
  return (
    normalized === PAYPAL_FX_SOURCE_CURRENCY ||
    PAYPAL_SUPPORTED_CURRENCIES.has(normalized)
  );
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

// Two surfaces gate PayPal differently, so this helper is intentionally
// bimodal on whether an order `currency` is supplied:
//
//   • Launch-readiness / publish (server, vault-aware) call with NO currency →
//     it requires the server-precomputed, vault-validated *live* credential
//     (`paypalConnected`, see `CheckoutPaymentMerchant`). Merely toggling PayPal
//     on must NOT mark a store launch-ready. This branch is unchanged from the
//     original single-arg signature, so those call sites keep working.
//
//   • Storefront checkout (client, no vault access) calls WITH the order
//     currency → it gates on the customer-facing enable toggle
//     (`custom_settings.paypal_enabled`), a *live* PayPal mode
//     (`custom_settings.paypal_mode === 'live'`), plus a PayPal-presentable
//     currency. Sandbox stores never render PayPal to customers (F10). The
//     create-order/capture-order routes independently fail closed on a
//     missing/invalid vault credential and on sandbox mode, so the client gate
//     mirrors how paystack/korapay gate their options on the enable flag alone.
export function isPaypalCheckoutAvailable(
  merchant: CheckoutPaymentMerchant | null | undefined,
  currency?: string | null
): boolean {
  if (!merchant) return false;

  // PayPal cannot pay a merchant outside its receive-capable countries, so it must
  // never be offered to their customers — no matter how the store is configured.
  // Applies to BOTH surfaces: the vault-aware launch check and the storefront.
  if (!isPaypalMerchantCountry(merchant.country)) return false;

  if (currency === undefined) {
    return merchant.paypalConnected === true;
  }

  if (readPaypalEnabled(merchant.feature_settings) !== true) return false;
  if (!isPaypalLiveMode(merchant.feature_settings)) return false;
  return isPaypalPresentableCurrency(currency);
}

// PayPal is offered ONLY where PayPal can actually pay the merchant, in a currency
// PayPal can actually present. Both checks fail closed.
//
// This used to be an exclusion gate ("not a Paystack-settlement country"), which
// meant a merchant in Ghana or Nigeria — where PayPal is effectively send-only and
// cannot pay them at all — could connect PayPal and publish as "payment ready",
// then take orders they could never be paid for. It also skipped the currency check
// entirely on this path, so a Kenyan store priced in KES could be marked launch-ready
// for a PayPal option its checkout can never render (KES is not a PayPal currency).
//
// Launch-readiness must ask the same question the customer's checkout will ask.
function canUsePaypalForLaunch(
  merchant: CheckoutPaymentMerchant | null | undefined
): boolean {
  if (!merchant) return false;
  // Can PayPal pay this merchant at all?
  if (!isPaypalMerchantCountry(merchant.country)) return false;
  // Can PayPal present this store's prices? (The storefront branch below checks the
  // ORDER currency; at launch we have only the store's, derived from its country.)
  if (
    !isPaypalPresentableCurrency(
      getCurrencyForCountry(merchant.country ?? null)
    )
  )
    return false;
  return isPaypalCheckoutAvailable(merchant);
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

// Gateways a storefront checkout can force. The first six MUST stay in sync
// with PAYMENT_GATEWAYS in `app/api/payments/initialize/route.ts` (the route's
// `gateway` field). `paypal` is NOT in that list — it settles through its own
// dedicated create-order/capture-order routes, not the initialize route — but
// it's included here so the storefront and any forced-gateway guard can gate a
// forced PayPal selection through the same availability matrix.
export type ForcedCheckoutGateway =
  | 'paystack'
  | 'korapay'
  | 'juicyway'
  | 'credit_direct'
  | 'credpal'
  | 'klump'
  | 'paypal';

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
    case 'paypal':
      return isPaypalCheckoutAvailable(merchant, currency);
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
    isPayOnDeliveryCheckoutAvailable(merchant) ||
    canUsePaypalForLaunch(merchant)
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

  // Wave 2 (BYOK Phase 2 item 10): a non-NG merchant can also satisfy this
  // requirement with a connected, validated PayPal account — NG merchants
  // stay on the Paystack bank-account requirement below regardless of
  // `paypalConnected` (see `canUsePaypalForLaunch`).
  if (canUsePaypalForLaunch(merchant)) {
    return {
      id: 'payment_method',
      label: 'Enable a payment method',
      description: 'PayPal is connected for customer checkout',
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
    description:
      'Enable Pay on Delivery or connect a payment provider (e.g. PayPal) to accept online payments',
    completed: false,
  };
}
