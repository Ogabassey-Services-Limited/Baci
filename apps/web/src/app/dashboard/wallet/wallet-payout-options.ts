const DEFAULT_PAYOUT_AMOUNT_OPTIONS = [1000, 2000, 5000, 10_000] as const;

const PAYOUT_AMOUNT_OPTIONS_BY_CURRENCY: Record<string, readonly number[]> = {
  NGN: DEFAULT_PAYOUT_AMOUNT_OPTIONS,
  INR: [1000, 2500, 5000, 10_000],
};

export function getWalletPayoutAmountOptions(
  payoutCurrency?: string | null,
  selectedAmount?: number | null
) {
  const normalizedCurrency = payoutCurrency?.trim().toUpperCase() || 'NGN';
  const configuredOptions =
    PAYOUT_AMOUNT_OPTIONS_BY_CURRENCY[normalizedCurrency] ??
    DEFAULT_PAYOUT_AMOUNT_OPTIONS;

  if (
    selectedAmount === undefined ||
    selectedAmount === null ||
    !Number.isFinite(selectedAmount) ||
    selectedAmount <= 0 ||
    configuredOptions.includes(selectedAmount)
  ) {
    return [...configuredOptions];
  }

  return [...configuredOptions, selectedAmount].sort(
    (first, second) => first - second
  );
}
