const JUICYWAY_PLATFORM_FEE_RATE = 0.015;
const KOBO_PER_NAIRA = 100;

export function calculateJuicywayPlatformFee(grossAmount: number): number {
  if (!Number.isFinite(grossAmount) || grossAmount < 0) {
    throw new RangeError(
      'Juicyway gross amount must be finite and non-negative'
    );
  }
  return (
    Math.round(grossAmount * KOBO_PER_NAIRA * JUICYWAY_PLATFORM_FEE_RATE) /
    KOBO_PER_NAIRA
  );
}
