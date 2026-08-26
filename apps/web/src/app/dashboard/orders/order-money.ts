export function parseOptionalOrderAmount(
  value: string | number | null | undefined
) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return undefined;
  }

  const amount = Number.parseFloat(String(value));
  return Number.isFinite(amount) ? amount : undefined;
}
