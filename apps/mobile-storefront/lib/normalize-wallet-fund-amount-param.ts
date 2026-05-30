export function normalizeWalletFundAmountParam(
  value: string | string[] | undefined
): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const amount = Number(rawValue);
  if (!Number.isFinite(amount) || amount <= 0) {
    return '';
  }

  // Wallet top-ups use whole naira amounts, so fractional required amounts round up.
  return String(Math.ceil(amount));
}
