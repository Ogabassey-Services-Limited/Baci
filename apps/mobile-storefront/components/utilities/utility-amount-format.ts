const DEFAULT_UTILITY_AMOUNT_LOCALE = 'en-NG';

export function createUtilityAmountFormatter(
  locale = DEFAULT_UTILITY_AMOUNT_LOCALE
): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export const UTILITY_AMOUNT_FORMATTER = createUtilityAmountFormatter();

export function formatUtilityAmountInput(
  amount: number | string | null | undefined
): string {
  if (amount === null || amount === undefined) {
    return '';
  }

  const normalizedAmount = String(amount).replace(/,/g, '').trim();
  if (!normalizedAmount) {
    return '';
  }

  const numericAmount = Number(normalizedAmount);
  return Number.isFinite(numericAmount)
    ? UTILITY_AMOUNT_FORMATTER.format(numericAmount)
    : '';
}
