import { createHash } from 'node:crypto';

interface LegacyManualPaymentIdentity {
  amount: number;
  merchantId: string;
  notes?: string;
  orderId: string;
  paymentMethod?: string;
  reference?: string;
  userId: string;
}

export function createLegacyManualPaymentIdempotencyKey(
  identity: LegacyManualPaymentIdentity
): string {
  const fingerprint = JSON.stringify([
    identity.merchantId,
    identity.userId,
    identity.orderId,
    identity.amount,
    identity.paymentMethod ?? null,
    identity.reference ?? null,
    identity.notes ?? null,
  ]);

  return `legacy:${createHash('sha256').update(fingerprint).digest('hex')}`;
}
