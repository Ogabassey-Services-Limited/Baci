export function formatUtilityAmountInput(amount: number | string) {
  const digits = String(amount).replace(/\D/g, '');
  const numericAmount = Number(digits);

  return numericAmount ? numericAmount.toLocaleString() : '';
}
