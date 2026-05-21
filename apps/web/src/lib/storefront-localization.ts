// Default unknown storefront country to Nigeria because current storefront SEO
// inventory and payment copy is Nigeria-first unless a merchant says otherwise.
export function getCountryShoppingContext(country?: string | null) {
  return country === 'NG' || !country ? 'in Nigeria' : '';
}

const LOCALE_BY_COUNTRY: Record<string, string> = {
  GH: 'en-GH',
  KE: 'en-KE',
  NG: 'en-NG',
  US: 'en-US',
};

export function getStorefrontLocale(country?: string | null) {
  return country ? (LOCALE_BY_COUNTRY[country] ?? 'en-NG') : 'en-NG';
}

export function appendCountryContext(value: string, countryContext: string) {
  return countryContext ? `${value} ${countryContext}` : value;
}
