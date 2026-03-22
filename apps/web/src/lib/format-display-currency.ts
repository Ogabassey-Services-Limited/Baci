const formatterCache = new Map<string, Intl.NumberFormat>();
const CURRENCY_LOCALE_MAP: Record<string, string> = {
  NGN: 'en-NG',
  GHS: 'en-GH',
  KES: 'en-KE',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  ZAR: 'en-ZA',
  XAF: 'fr-CM',
  XOF: 'fr-SN',
};

export function formatDisplayCurrency(amount: number, currency = 'NGN') {
  let formatter = formatterCache.get(currency);

  if (!formatter) {
    formatter = new Intl.NumberFormat(
      CURRENCY_LOCALE_MAP[currency] || 'en-NG',
      {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
    formatterCache.set(currency, formatter);
  }

  return formatter.format(amount);
}
