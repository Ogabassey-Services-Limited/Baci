/**
 * The countries where a MERCHANT can actually receive money through PayPal.
 *
 * This is an allow-list on purpose. The gate used to be defined by exclusion —
 * "block Nigeria, allow everyone else" — which quietly offered PayPal to merchants
 * in countries where PayPal cannot pay them at all. Across Africa only a handful of
 * countries can receive and withdraw (South Africa, Kenya, Botswana, Lesotho,
 * Mauritius, Morocco, Mozambique, Senegal); everywhere else, including Nigeria, is
 * effectively send-only. A merchant there could connect PayPal, publish as
 * "payment ready", and take orders they can never actually be paid for.
 *
 * Being able to RECEIVE is necessary but not sufficient — the store's currency must
 * also be one PayPal can present (see `isPaypalPresentableCurrency`). The two checks
 * are deliberately separate and both fail closed. South Africa and Kenya sit in this
 * list because PayPal genuinely pays out there, but ZAR and KES are not PayPal
 * currencies, so those merchants only clear the gate if they price in a currency
 * PayPal supports (typically USD). That is the correct outcome, not an oversight.
 *
 * An unknown or missing country fails closed — we do not guess where a merchant
 * banks.
 */
const PAYPAL_MERCHANT_COUNTRIES: ReadonlySet<string> = new Set([
  // Core BYOK markets: PayPal pays out AND the local currency is presentable, so
  // the money never touches an FX conversion.
  'US', // USD
  'GB', // GBP
  'CA', // CAD
  'AU', // AUD
  'NZ', // NZD
  'CH', // CHF
  'SE', // SEK
  'NO', // NOK
  'DK', // DKK
  'PL', // PLN
  'CZ', // CZK
  'HU', // HUF
  'IL', // ILS
  'SG', // SGD
  'HK', // HKD
  'JP', // JPY
  'MX', // MXN
  'BR', // BRL
  'PH', // PHP
  'TH', // THB
  'TW', // TWD
  'MY', // MYR

  // Eurozone (EUR).
  'IE',
  'DE',
  'FR',
  'ES',
  'IT',
  'NL',
  'BE',
  'AT',
  'PT',
  'FI',
  'GR',
  'LU',
  'SK',
  'SI',
  'EE',
  'LV',
  'LT',
  'CY',
  'MT',

  // PayPal pays out here, but these local currencies are not supported by the
  // checkout currency gate. These merchants clear the gate only by pricing in a
  // presentable currency, so the country check does not block a merchant PayPal
  // is willing to pay.
  'ZA',
  'KE',
  'BW',
  'LS',
  'MU',
  'MA',
  'MZ',
  'SN',
]);

/**
 * True when a merchant in this country can be paid by PayPal.
 *
 * Fails closed on a missing/unknown country: an unset country is not evidence of
 * eligibility, and offering PayPal to a merchant who cannot be paid is worse than
 * offering nothing.
 */
export function isPaypalMerchantCountry(
  country: string | null | undefined
): boolean {
  if (!country) return false;
  return PAYPAL_MERCHANT_COUNTRIES.has(country.trim().toUpperCase());
}
