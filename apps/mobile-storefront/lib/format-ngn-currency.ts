const NGN_CURRENCY_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
});

export function formatNgnCurrency(amount: number): string {
  return NGN_CURRENCY_FORMATTER.format(amount);
}
