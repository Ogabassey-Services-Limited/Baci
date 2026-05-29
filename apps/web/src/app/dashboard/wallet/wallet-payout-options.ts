const DEFAULT_PAYOUT_AMOUNT_OPTIONS = [1000, 2000, 5000, 10_000] as const;

const PAYOUT_AMOUNT_OPTIONS_BY_CURRENCY = {
  NGN: DEFAULT_PAYOUT_AMOUNT_OPTIONS,
  INR: [1000, 2500, 5000, 10_000],
} as const satisfies Record<string, readonly number[]>;

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
    configuredOptions.includes(selectedAmount)
  ) {
    return [...configuredOptions];
  }

  return [...configuredOptions, selectedAmount].sort(
    (first, second) => first - second
  );
}
