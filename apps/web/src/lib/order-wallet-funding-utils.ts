import type { OrderWalletFundingIntent } from '@/lib/order-wallet-funding-intent-types';

export const ONE_KOBO = 0.01;
export const INTENT_TTL_MS = 30 * 60 * 1000;
export const PAYABLE_STATUSES: readonly string[] = ['pending', 'unpaid'];
const KOBO_PER_NAIRA = 100;

export function roundMoney(amount: number) {
  return Math.round(amount * KOBO_PER_NAIRA) / KOBO_PER_NAIRA;
}

export function buildWalletFundingIntentIdempotencyKey({
  customerId,
  merchantId,
  orderId,
  startedAt,
}: {
  customerId: string;
  merchantId: string;
  orderId: string;
  startedAt: Date;
}) {
  if (!(startedAt instanceof Date) || !Number.isFinite(startedAt.getTime())) {
    throw new TypeError('startedAt must be a valid Date');
  }
  return [
    'order-wallet-funding',
    orderId,
    merchantId,
    customerId,
    startedAt.toISOString(),
  ].join(':');
}

export function isOrderPayable(paymentStatus: string) {
  return PAYABLE_STATUSES.includes(paymentStatus);
}

export function paidAtFitsIntent(
  intent: OrderWalletFundingIntent,
  paidAt: Date
) {
  const createdAt = new Date(intent.createdAt);
  const expiresAt = new Date(intent.expiresAt);
  if (
    !Number.isFinite(paidAt.getTime()) ||
    !Number.isFinite(createdAt.getTime()) ||
    !Number.isFinite(expiresAt.getTime())
  ) {
    return false;
  }
  return paidAt >= createdAt && paidAt < expiresAt;
}

/**
 * Full-cover check: the transfer alone covers the intent's remaining
 * expected amount (ONE_KOBO tolerance for gateway rounding drift). Used
 * ONLY as the disambiguator when several intents are active on one wallet
 * account — a single active intent accepts partial transfers instead.
 */
export function amountFitsIntent(
  intent: OrderWalletFundingIntent,
  amount: number
) {
  const remaining = Math.max(intent.expectedAmount - intent.fundedAmount, 0);
  return amount + ONE_KOBO >= remaining;
}
