
export interface Country {
    name: string;
    code: string;
    flag: string;
    currency: string;
    phoneCode: string;
}

export const COUNTRIES: Country[] = [
  { name: 'United States', code: 'US', flag: '🇺🇸', currency: 'USD', phoneCode: '+1' },
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬', currency: 'NGN', phoneCode: '+234' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', currency: 'GBP', phoneCode: '+44' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦', currency: 'CAD', phoneCode: '+1' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺', currency: 'AUD', phoneCode: '+61' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪', currency: 'EUR', phoneCode: '+49' },
  { name: 'France', code: 'FR', flag: '🇫🇷', currency: 'EUR', phoneCode: '+33' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵', currency: 'JPY', phoneCode: '+81' },
  { name: 'India', code: 'IN', flag: '🇮🇳', currency: 'INR', phoneCode: '+91' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷', currency: 'BRL', phoneCode: '+55' },
  { name: 'South Africa', code: 'ZA', flag: '🇿🇦', currency: 'ZAR', phoneCode: '+27' },
];

export function getCountryByCode(code: string): Country | undefined {
    return COUNTRIES.find(country => country.code === code);
}
