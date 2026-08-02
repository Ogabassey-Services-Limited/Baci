import { MERCHANT_COUNTRIES } from '@baci/shared/constants';

export interface Country {
  name: string;
  code: string;
  flag: string;
  currency: string;
  phoneCode: string;
  currencySymbol: string;
}

export const COUNTRIES: Country[] = MERCHANT_COUNTRIES.map((country) => ({
  ...country,
}));

// Pre-computed maps for O(1) lookup
const CODE_MAP = new Map<string, Country>();
const NAME_MAP = new Map<string, Country>();

for (const country of COUNTRIES) {
  CODE_MAP.set(country.code, country);
  NAME_MAP.set(country.name.toLowerCase(), country);
}

export function getCountryByCode(codeOrName: string): Country | undefined {
  if (!codeOrName || typeof codeOrName !== 'string') return undefined;

  // Try direct code lookup (most common case)
  const byCode = CODE_MAP.get(codeOrName.toUpperCase());
  if (byCode) return byCode;

  // Fallback to name lookup
  return NAME_MAP.get(codeOrName.toLowerCase());
}
