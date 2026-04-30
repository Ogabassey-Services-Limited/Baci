export function sanitizeAmountInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [whole = '', ...decimalParts] = cleaned.split('.');
  const decimals = decimalParts.join('').slice(0, 2);
  const hasTrailingDecimal = cleaned.endsWith('.') && !decimals;
  if (!whole && !decimals) {
    return '';
  }

  return `${whole}${decimals || hasTrailingDecimal ? `.${decimals}` : ''}`;
}
