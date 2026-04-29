const UTILITY_AMOUNT_FORMATTER = new Intl.NumberFormat('en-NG', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

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
