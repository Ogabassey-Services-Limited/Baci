const trimFixed = (value: number, fractionDigits: number) =>
  Number.parseFloat(value.toFixed(fractionDigits)).toString();

const compactThousands = (value: number, nextSuffix: string) => {
  const thousands = Math.floor((value / 1_000) * 10) / 10;
  return thousands >= 1_000 ? `1${nextSuffix}` : `${trimFixed(thousands, 1)}k`;
};

export const formatPrice = (amount: number, currencySymbol: string) =>
  `${currencySymbol}${amount.toLocaleString()}`;

export function getCurrencySymbol(currencyCode: string | null | undefined) {
  const symbols: Record<string, string> = {
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    USD: '$',
  };

  return symbols[currencyCode || 'NGN'] || '₦';
}

export const formatLargePrice = (amount: number, currencySymbol: string) => {
  if (amount >= 1_000_000_000) {
    return `${currencySymbol}${trimFixed(amount / 1_000_000_000, 3)}B`;
  }
  if (amount >= 1_000_000) {
    return `${currencySymbol}${trimFixed(amount / 1_000_000, 3)}M`;
  }
  if (amount >= 1_000) {
    return `${currencySymbol}${compactThousands(amount, 'M')}`;
  }
  return formatPrice(amount, currencySymbol);
};

export const formatMetric = (value: number) => {
  if (value >= 1_000_000) return `${trimFixed(value / 1_000_000, 1)}M`;
  if (value >= 1_000) return compactThousands(value, 'M');
  return value.toLocaleString();
};

export type Category = { id: string; name: string; slug: string };
