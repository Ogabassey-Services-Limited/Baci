/** Minimal shape of a cart line needed to decide voucher pruning. */
export interface VoucherCartLine {
  id: string;
  voucher_token?: string | null;
  voucher_award_id?: string | null;
}

interface SelectOptions {
  /** True when the order failed with an unredeemable-voucher rejection code. */
  isRejection: boolean;
  /** The exact token the server rejected, when it identified one. */
  rejectedVoucherToken?: string | null;
}

/**
 * Choose which voucher-backed cart line ids to prune after `/api/orders` rejects
 * an order. Mirrors the web `selectRejectedVoucherLines` policy: prune only the
 * server-identified token so a multi-prize cart never loses a still-valid
 * voucher; when the server did not identify one, only prune in the unambiguous
 * single-voucher case.
 */
export function selectRejectedVoucherLineIds<T extends VoucherCartLine>(
  items: readonly T[],
  { isRejection, rejectedVoucherToken }: SelectOptions
): string[] {
  if (!isRejection) return [];

  const voucherLines = items.filter(
    (item) => item.voucher_token || item.voucher_award_id
  );

  if (rejectedVoucherToken) {
    return voucherLines
      .filter((item) => item.voucher_token === rejectedVoucherToken)
      .map((item) => item.id);
  }

  return voucherLines.length === 1 ? [voucherLines[0].id] : [];
}
