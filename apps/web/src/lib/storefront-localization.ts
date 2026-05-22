// Default unknown storefront country to Nigeria because current storefront SEO
// inventory and payment copy is Nigeria-first unless a merchant says otherwise.
function normalizeCountryCode(country?: string | null) {
  return country?.trim().toUpperCase() || null;
}

export function getCountryShoppingContext(country?: string | null) {
  const normalizedCountry = normalizeCountryCode(country);

  return normalizedCountry === 'NG' || !normalizedCountry ? 'in Nigeria' : '';
}

const LOCALE_BY_COUNTRY: Record<string, string> = {
  GH: 'en-GH',
  KE: 'en-KE',
  NG: 'en-NG',
  US: 'en-US',
};

export function getStorefrontLocale(country?: string | null) {
  const normalizedCountry = normalizeCountryCode(country);

  return normalizedCountry
    ? (LOCALE_BY_COUNTRY[normalizedCountry] ?? 'en-NG')
    : 'en-NG';
}

export function appendCountryContext(value: string, countryContext: string) {
  return countryContext ? `${value} ${countryContext}` : value;
}
