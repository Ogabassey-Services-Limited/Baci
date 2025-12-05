/**
 * Maps ISO 3166-1 alpha-2 country codes to ISO 4217 currency codes.
 * Used for displaying prices in the correct currency based on merchant's country.
 */
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // Africa
  NG: 'NGN', // Nigeria
  KE: 'KES', // Kenya
  GH: 'GHS', // Ghana
  ZA: 'ZAR', // South Africa
  EG: 'EGP', // Egypt
  MA: 'MAD', // Morocco
  TZ: 'TZS', // Tanzania
  UG: 'UGX', // Uganda
  RW: 'RWF', // Rwanda

  // Americas
  US: 'USD', // United States
  CA: 'CAD', // Canada
  MX: 'MXN', // Mexico
  BR: 'BRL', // Brazil
  AR: 'ARS', // Argentina
  CO: 'COP', // Colombia
  CL: 'CLP', // Chile

  // Europe - Eurozone
  DE: 'EUR', // Germany
  FR: 'EUR', // France
  IT: 'EUR', // Italy
  ES: 'EUR', // Spain
  NL: 'EUR', // Netherlands
  BE: 'EUR', // Belgium
  AT: 'EUR', // Austria
  PT: 'EUR', // Portugal
  IE: 'EUR', // Ireland
  FI: 'EUR', // Finland
  GR: 'EUR', // Greece
  SK: 'EUR', // Slovakia
  SI: 'EUR', // Slovenia
  LU: 'EUR', // Luxembourg
  EE: 'EUR', // Estonia
  LV: 'EUR', // Latvia
  LT: 'EUR', // Lithuania
  CY: 'EUR', // Cyprus
  MT: 'EUR', // Malta
  HR: 'EUR', // Croatia

  // Europe - Non-Eurozone
  GB: 'GBP', // United Kingdom
  CH: 'CHF', // Switzerland
  SE: 'SEK', // Sweden
  NO: 'NOK', // Norway
  DK: 'DKK', // Denmark
  PL: 'PLN', // Poland
  CZ: 'CZK', // Czech Republic
  HU: 'HUF', // Hungary
  RO: 'RON', // Romania
  BG: 'BGN', // Bulgaria

  // Asia Pacific
  AU: 'AUD', // Australia
  NZ: 'NZD', // New Zealand
  JP: 'JPY', // Japan
  CN: 'CNY', // China
  HK: 'HKD', // Hong Kong
  SG: 'SGD', // Singapore
  MY: 'MYR', // Malaysia
  ID: 'IDR', // Indonesia
  TH: 'THB', // Thailand
  PH: 'PHP', // Philippines
  VN: 'VND', // Vietnam
  IN: 'INR', // India
  PK: 'PKR', // Pakistan
  BD: 'BDT', // Bangladesh
  KR: 'KRW', // South Korea
  TW: 'TWD', // Taiwan

  // Middle East
  AE: 'AED', // United Arab Emirates
  SA: 'SAR', // Saudi Arabia
  IL: 'ILS', // Israel
  TR: 'TRY', // Turkey
  QA: 'QAR', // Qatar
  KW: 'KWD', // Kuwait
  BH: 'BHD', // Bahrain
  OM: 'OMR', // Oman
};

/**
 * Get currency code for a given country code.
 * Falls back to USD for unknown countries.
 *
 * @param country - ISO 3166-1 alpha-2 country code (e.g., 'NG', 'US', 'GB')
 * @returns ISO 4217 currency code (e.g., 'NGN', 'USD', 'GBP')
 */
export function getCurrencyForCountry(country: string | null): string {
  return COUNTRY_CURRENCY_MAP[country || ''] || 'USD';
}

/**
 * Maps ISO 3166-1 alpha-2 country codes to BCP 47 locale strings.
 * Extracted as module constant for performance (avoids recreation on each call).
 */
const COUNTRY_LOCALE_MAP: Record<string, string> = {
  // Africa
  NG: 'en-NG',
  KE: 'en-KE',
  GH: 'en-GH',
  ZA: 'en-ZA',
  EG: 'ar-EG',
  MA: 'ar-MA',
  TZ: 'sw-TZ',
  UG: 'en-UG',
  RW: 'rw-RW',
  // Americas
  US: 'en-US',
  CA: 'en-CA',
  MX: 'es-MX',
  BR: 'pt-BR',
  AR: 'es-AR',
  CO: 'es-CO',
  CL: 'es-CL',
  // Europe - Eurozone
  DE: 'de-DE',
  FR: 'fr-FR',
  IT: 'it-IT',
  ES: 'es-ES',
  NL: 'nl-NL',
  BE: 'nl-BE',
  AT: 'de-AT',
  PT: 'pt-PT',
  IE: 'en-IE',
  FI: 'fi-FI',
  GR: 'el-GR',
  SK: 'sk-SK',
  SI: 'sl-SI',
  LU: 'fr-LU',
  EE: 'et-EE',
  LV: 'lv-LV',
  LT: 'lt-LT',
  CY: 'el-CY',
  MT: 'mt-MT',
  HR: 'hr-HR',
  // Europe - Non-Eurozone
  GB: 'en-GB',
  CH: 'de-CH',
  SE: 'sv-SE',
  NO: 'nb-NO',
  DK: 'da-DK',
  PL: 'pl-PL',
  CZ: 'cs-CZ',
  HU: 'hu-HU',
  RO: 'ro-RO',
  BG: 'bg-BG',
  // Asia Pacific
  AU: 'en-AU',
  NZ: 'en-NZ',
  JP: 'ja-JP',
  CN: 'zh-CN',
  HK: 'zh-HK',
  SG: 'en-SG',
  MY: 'ms-MY',
  ID: 'id-ID',
  TH: 'th-TH',
  PH: 'en-PH',
  VN: 'vi-VN',
  IN: 'en-IN',
  PK: 'ur-PK',
  BD: 'bn-BD',
  KR: 'ko-KR',
  TW: 'zh-TW',
  // Middle East
  AE: 'ar-AE',
  SA: 'ar-SA',
  IL: 'he-IL',
  TR: 'tr-TR',
  QA: 'ar-QA',
  KW: 'ar-KW',
  BH: 'ar-BH',
  OM: 'ar-OM',
};

/**
 * Get locale string for a given country code.
 * Used for proper number/currency formatting with Intl.NumberFormat.
 *
 * @param country - ISO 3166-1 alpha-2 country code
 * @returns BCP 47 locale string (e.g., 'en-NG', 'en-US', 'en-GB')
 */
export function getLocaleForCountry(country: string | null): string {
  const normalized = (country || '').toUpperCase();
  return COUNTRY_LOCALE_MAP[normalized] || 'en-US';
}

/**
 * Format a price with the appropriate currency and locale.
 *
 * @param amount - The numeric amount to format
 * @param country - ISO 3166-1 alpha-2 country code
 * @param options - Additional Intl.NumberFormat options
 * @returns Formatted currency string (e.g., '₦1,234.00', '$99.99')
 */
export function formatPrice(
  amount: number,
  country: string | null,
  options: Partial<Intl.NumberFormatOptions> = {}
): string {
  const currency = getCurrencyForCountry(country);
  const locale = getLocaleForCountry(country);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
    ...options,
  }).format(amount);
}
