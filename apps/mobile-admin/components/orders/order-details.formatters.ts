const orderDetailsPriceFormatterCache = new Map<string, Intl.NumberFormat>();

function getOrderDetailsPriceFormatter(currency: string): Intl.NumberFormat {
  let formatter = orderDetailsPriceFormatterCache.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    });
    orderDetailsPriceFormatterCache.set(currency, formatter);
  }
  return formatter;
}

export function formatOrderDetailsPrice(
  amount: number,
  merchantCurrency: string
) {
  try {
    return getOrderDetailsPriceFormatter(merchantCurrency).format(amount);
  } catch (error) {
    console.warn('[OrderDetails] Invalid currency for price format', error);
    return getOrderDetailsPriceFormatter('NGN').format(amount);
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
