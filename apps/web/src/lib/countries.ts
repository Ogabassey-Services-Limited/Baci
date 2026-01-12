export interface Country {
  name: string;
  code: string;
  flag: string;
  currency: string;
  phoneCode: string;
  currencySymbol: string;
}

export const COUNTRIES: Country[] = [
  {
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    phoneCode: '+1',
    currencySymbol: '$',
  },
  {
    name: 'Nigeria',
    code: 'NG',
    flag: '🇳🇬',
    currency: 'NGN',
    phoneCode: '+234',
    currencySymbol: '₦',
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    flag: '🇬🇧',
    currency: 'GBP',
    phoneCode: '+44',
    currencySymbol: '£',
  },
  {
    name: 'Canada',
    code: 'CA',
    flag: '🇨🇦',
    currency: 'CAD',
    phoneCode: '+1',
    currencySymbol: '$',
  },
  {
    name: 'Australia',
    code: 'AU',
    flag: '🇦🇺',
    currency: 'AUD',
    phoneCode: '+61',
    currencySymbol: '$',
  },
  {
    name: 'Germany',
    code: 'DE',
    flag: '🇩🇪',
    currency: 'EUR',
    phoneCode: '+49',
    currencySymbol: '€',
  },
  {
    name: 'France',
    code: 'FR',
    flag: '🇫🇷',
    currency: 'EUR',
    phoneCode: '+33',
    currencySymbol: '€',
  },
  {
    name: 'Japan',
    code: 'JP',
    flag: '🇯🇵',
    currency: 'JPY',
    phoneCode: '+81',
    currencySymbol: '¥',
  },
  {
    name: 'India',
    code: 'IN',
    flag: '🇮🇳',
    currency: 'INR',
    phoneCode: '+91',
    currencySymbol: '₹',
  },
  {
    name: 'Brazil',
    code: 'BR',
    flag: '🇧🇷',
    currency: 'BRL',
    phoneCode: '+55',
    currencySymbol: 'R$',
  },
  {
    name: 'South Africa',
    code: 'ZA',
    flag: '🇿🇦',
    currency: 'ZAR',
    phoneCode: '+27',
    currencySymbol: 'R',
  },
];

export function getCountryByCode(codeOrName: string): Country | undefined {
  if (!codeOrName) return undefined;

  const normalizedInput = codeOrName.toUpperCase();
  const normalizedInputTitle = codeOrName.toLowerCase();

  return COUNTRIES.find((country) =>
    country.code === normalizedInput ||
    country.name.toLowerCase() === normalizedInputTitle
  );
}
