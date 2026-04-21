export function formatOrderDetailsPrice(
  amount: number,
  merchantCurrency: string
) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: merchantCurrency,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch (error) {
    console.warn('[OrderDetails] Invalid currency for price format', error);
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}

export function parseOrderDetailsCurrencyInput(formattedValue: string) {
  const normalized = formattedValue.replace(/,/g, '');
  const cleaned = normalized.replace(/[^0-9.]/g, '');
  const [whole = '', ...decimals] = cleaned.split('.');

  return decimals.length > 0 ? `${whole}.${decimals.join('')}` : whole;
}

export function formatOrderDetailsDate(dateString: string) {
  if (!dateString) {
    return '-';
  }

  const nextDate = new Date(dateString);
  if (Number.isNaN(nextDate.getTime())) {
    return '-';
  }

  return nextDate.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
