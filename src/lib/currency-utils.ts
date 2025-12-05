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
 * Get locale string for a given country code.
 * Used for proper number/currency formatting with Intl.NumberFormat.
 *
 * @param country - ISO 3166-1 alpha-2 country code
 * @returns BCP 47 locale string (e.g., 'en-NG', 'en-US', 'en-GB')
 */
export function getLocaleForCountry(country: string | null): string {
  const localeMap: Record<string, string> = {
    NG: 'en-NG',
    US: 'en-US',
    GB: 'en-GB',
    CA: 'en-CA',
    AU: 'en-AU',
    NZ: 'en-NZ',
    KE: 'en-KE',
    GH: 'en-GH',
    ZA: 'en-ZA',
    IN: 'en-IN',
    SG: 'en-SG',
    IE: 'en-IE',
    DE: 'de-DE',
    FR: 'fr-FR',
    IT: 'it-IT',
    ES: 'es-ES',
    NL: 'nl-NL',
    PT: 'pt-PT',
    BR: 'pt-BR',
    MX: 'es-MX',
    JP: 'ja-JP',
    CN: 'zh-CN',
    KR: 'ko-KR',
    AE: 'ar-AE',
    SA: 'ar-SA',
    IL: 'he-IL',
    TR: 'tr-TR',
  };

  return localeMap[country || ''] || 'en-US';
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
