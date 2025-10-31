
export interface Country {
    name: string;
    code: string;
    flag: string;
    currency: string;
}

export const COUNTRIES: Country[] = [
  { name: 'United States', code: 'US', flag: '🇺🇸', currency: 'USD' },
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬', currency: 'NGN' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', currency: 'GBP' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦', currency: 'CAD' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺', currency: 'AUD' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪', currency: 'EUR' },
  { name: 'France', code: 'FR', flag: '🇫🇷', currency: 'EUR' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵', currency: 'JPY' },
  { name: 'India', code: 'IN', flag: '🇮🇳', currency: 'INR' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷', currency: 'BRL' },
  { name: 'South Africa', code: 'ZA', flag: '🇿🇦', currency: 'ZAR' },
];

export function getCountryByCode(code: string): Country | undefined {
    return COUNTRIES.find(country => country.code === code);
}
