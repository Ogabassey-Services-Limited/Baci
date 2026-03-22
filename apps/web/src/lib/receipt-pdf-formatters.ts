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

export function formatReceiptCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(CURRENCY_LOCALE_MAP[currency] || 'en-NG', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatReceiptDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
