const CURRENCY_TOKEN_BY_SYMBOL: Record<string, string> = {
  $: 'usd',
  '£': 'gbp',
  '€': 'eur',
  '₦': 'ngn',
};

export function normalizeContentCurrencyTokens(value: string) {
  return value
    .replace(/\bus\s*\$\s*(?=\d)/giu, ' usd ')
    .replace(
      /[£$€₦]/gu,
      (symbol) => ` ${CURRENCY_TOKEN_BY_SYMBOL[symbol] ?? ''} `
    )
    .replace(/\bus(\d+(?:\.\d+)?)\b/giu, ' usd $1')
    .replace(/\s+/gu, ' ');
}
