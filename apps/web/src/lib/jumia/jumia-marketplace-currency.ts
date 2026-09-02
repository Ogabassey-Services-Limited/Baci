const JUMIA_MARKETPLACE_CURRENCIES: Record<string, string> = {
  DZ: 'DZD',
  EG: 'EGP',
  GH: 'GHS',
  CI: 'XOF',
  KE: 'KES',
  MA: 'MAD',
  NG: 'NGN',
  SN: 'XOF',
  TN: 'TND',
  UG: 'UGX',
  ZA: 'ZAR',
};

export function resolveJumiaMarketplaceCurrency(
  countryCode: string | null | undefined
): { ok: true; currency: string } | { ok: false; error: string } {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized) {
    return {
      ok: false,
      error: 'Jumia integration is missing a marketplace country code',
    };
  }

  const currency = JUMIA_MARKETPLACE_CURRENCIES[normalized];
  if (!currency) {
    return {
      ok: false,
      error: `Jumia marketplace country ${normalized} is not supported for export`,
    };
  }

  return { ok: true, currency };
}
