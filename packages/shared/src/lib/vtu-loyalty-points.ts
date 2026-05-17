export const VTU_AIRTIME_POINTS_CASHBACK_DIVISOR = 3;
export const VTU_MIN_REDEEMABLE_POINTS = 100;

export type VtuPointsTransactionType =
  | 'airtime'
  | 'data'
  | 'electricity'
  | 'cable_tv'
  | 'betting';

export function calculateVtuAirtimeLoyaltyPoints({
  customerCashback,
  transactionType,
}: {
  customerCashback: number | null | undefined;
  transactionType: VtuPointsTransactionType;
}) {
  if (transactionType !== 'airtime') {
    return 0;
  }

  const cashbackAmount = Number(customerCashback ?? 0);
  if (
    !Number.isFinite(cashbackAmount) ||
    cashbackAmount <= 0 ||
    Math.abs(cashbackAmount) > Number.MAX_SAFE_INTEGER
  ) {
    return 0;
  }

  const points = Math.floor(
    cashbackAmount / VTU_AIRTIME_POINTS_CASHBACK_DIVISOR
  );

  return Number.isSafeInteger(points) && points > 0 ? points : 0;
}

export function isRedeemablePointAmount(points: number) {
  return (
    Number.isSafeInteger(points) &&
    points >= VTU_MIN_REDEEMABLE_POINTS &&
    points % VTU_MIN_REDEEMABLE_POINTS === 0
  );
}

export function getRedeemablePointBalance(points: number) {
  if (!Number.isSafeInteger(points) || points < VTU_MIN_REDEEMABLE_POINTS) {
    return 0;
  }

  return points - (points % VTU_MIN_REDEEMABLE_POINTS);
}
