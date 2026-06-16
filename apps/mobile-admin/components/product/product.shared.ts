const trimFixed = (value: number, fractionDigits: number) =>
  Number.parseFloat(value.toFixed(fractionDigits)).toString();

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
    return `${currencySymbol}${trimFixed(amount / 1_000, 1)}k`;
  }
  return formatPrice(amount, currencySymbol);
};

export const formatMetric = (value: number) => {
  if (value >= 1_000_000) return `${trimFixed(value / 1_000_000, 1)}M`;
  if (value >= 1_000) return `${trimFixed(value / 1_000, 1)}k`;
  return value.toLocaleString();
};

export type Category = { id: string; name: string; slug: string };
