const trimFixed = (value: number, fractionDigits: number) =>
  Number.parseFloat(value.toFixed(fractionDigits)).toString();

const roundedValue = (value: number, divisor: number, fractionDigits: number) =>
  Number.parseFloat((value / divisor).toFixed(fractionDigits));

const compactThousands = (value: number, nextSuffix: string) => {
  const thousands = Math.floor((value / 1_000) * 10) / 10;
  return thousands >= 1_000 ? `1${nextSuffix}` : `${trimFixed(thousands, 1)}k`;
};

export const formatPrice = (amount: number, currencySymbol: string) =>
  `${currencySymbol}${amount.toLocaleString()}`;

export function getCurrencySymbol(currencyCode: string | null | undefined) {
  const symbols: Record<string, string> = {
    AED: 'د.إ',
    AUD: '$',
    BRL: 'R$',
    CAD: '$',
    EGP: 'E£',
    EUR: '€',
    GBP: '£',
    GHS: 'GH₵',
    INR: '₹',
    JPY: '¥',
    KES: 'KSh',
    NGN: '₦',
    USD: '$',
    XAF: 'FCFA',
    XOF: 'CFA',
    ZAR: 'R',
  };

  const normalizedCode = (currencyCode || 'NGN').toUpperCase();
  return symbols[normalizedCode] || normalizedCode;
}

export const formatLargePrice = (amount: number, currencySymbol: string) => {
  if (amount >= 1_000_000_000_000) {
    return `${currencySymbol}${trimFixed(amount / 1_000_000_000_000, 3)}T`;
  }
  if (amount >= 1_000_000_000) {
    const billions = roundedValue(amount, 1_000_000_000, 3);
    if (billions >= 1_000) {
      return `${currencySymbol}${trimFixed(amount / 1_000_000_000_000, 3)}T`;
    }
    return `${currencySymbol}${billions}B`;
  }
  if (amount >= 1_000_000) {
    const millions = roundedValue(amount, 1_000_000, 3);
    if (millions >= 1_000) {
      return `${currencySymbol}${trimFixed(amount / 1_000_000_000, 3)}B`;
    }
    return `${currencySymbol}${millions}M`;
  }
  if (amount >= 1_000) {
    return `${currencySymbol}${compactThousands(amount, 'M')}`;
  }
  return formatPrice(amount, currencySymbol);
};

export const formatMetric = (value: number) => {
  if (value >= 1_000_000_000) return `${trimFixed(value / 1_000_000_000, 1)}B`;
  if (value >= 1_000_000) {
    const millions = roundedValue(value, 1_000_000, 1);
    if (millions >= 1_000) return `${trimFixed(value / 1_000_000_000, 1)}B`;
    return `${millions}M`;
  }
  if (value >= 1_000) return compactThousands(value, 'M');
  return value.toLocaleString();
};

export type Category = { id: string; name: string; slug: string };
