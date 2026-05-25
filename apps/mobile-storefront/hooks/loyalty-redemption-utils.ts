import { VTU_MIN_REDEEMABLE_POINTS } from '@baci/shared/lib';

export function redemptionBalanceSnapshotKey({
  customerId,
  merchantId,
  points,
}: {
  customerId: string;
  merchantId: string;
  points: number;
}): string {
  return `${encodeURIComponent(customerId)}|${encodeURIComponent(merchantId)}|${points}`;
}

export function getRedeemPointValidationError(points: number): string | null {
  if (!Number.isSafeInteger(points) || points <= 0) {
    return 'Invalid redemption amount';
  }

  if (points < VTU_MIN_REDEEMABLE_POINTS) {
    return `Minimum redemption is ${VTU_MIN_REDEEMABLE_POINTS} points`;
  }

  if (points % VTU_MIN_REDEEMABLE_POINTS !== 0) {
    return `Redeem points in ${VTU_MIN_REDEEMABLE_POINTS}-point blocks`;
  }

  return null;
}
