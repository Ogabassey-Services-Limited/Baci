export function isWalletFundingDeepLink(
  value: string | readonly string[] | undefined
): boolean {
  return Array.isArray(value) ? value.includes('1') : value === '1';
}

export function parseUsdtWalletFundingAmount(
  value: string | readonly string[] | undefined
): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 1 && amount <= 10_000
    ? amount
    : undefined;
}

const USDT_FUNDING_REFERENCE_PATTERN = /^wusdt_[a-z0-9_]{6,44}$/i;

export function parseUsdtWalletFundingReference(
  value: string | readonly string[] | undefined
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && USDT_FUNDING_REFERENCE_PATTERN.test(raw)
    ? raw
    : undefined;
}
