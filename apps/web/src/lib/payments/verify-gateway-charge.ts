import { verifyPayment as verifyKorapayPayment } from '@/lib/korapay';
import { verifyTransaction as verifyPaystackPayment } from '@/lib/paystack';

export const HEALABLE_GATEWAYS = ['paystack', 'korapay'] as const;
export type HealableGateway = (typeof HEALABLE_GATEWAYS)[number];

export function isHealableGateway(gateway: string): gateway is HealableGateway {
  return (HEALABLE_GATEWAYS as readonly string[]).includes(gateway);
}

export type GatewayChargeVerification =
  | {
      ok: true;
      amount: number;
      currency?: string;
      response: Record<string, unknown>;
    }
  | { ok: false; reason: string; gatewayStatus?: string };

// Re-verifies a captured charge with its gateway before the reconcile sweep
// heals anything. Distinguishes transient verification-unavailable failures
// (retry next run) from a definitive non-success verdict (permanent
// discrepancy that must go to ops).
export async function verifyGatewayCharge(
  gateway: HealableGateway,
  reference: string
): Promise<GatewayChargeVerification> {
  if (gateway === 'paystack') {
    const result = await verifyPaystackPayment(reference);
    if (!result.success) {
      // API/network failure: transient — retry next run, never stamp.
      return { ok: false, reason: 'paystack_verification_unavailable' };
    }
    if (result.data.status !== 'success') {
      // Definitive gateway verdict on a transaction we recorded as
      // completed — a real discrepancy that must go to ops.
      return {
        gatewayStatus: result.data.status,
        ok: false,
        reason: 'gateway_status_not_success',
      };
    }
    return {
      amount: result.data.amount / 100,
      currency: result.data.currency,
      ok: true,
      response: result.data as unknown as Record<string, unknown>,
    };
  }
  if (gateway === 'korapay') {
    const result = await verifyKorapayPayment(reference);
    if (!result.success) {
      return { ok: false, reason: 'korapay_verification_unavailable' };
    }
    if (result.data.status !== 'success') {
      return {
        gatewayStatus: result.data.status,
        ok: false,
        reason: 'gateway_status_not_success',
      };
    }
    return {
      amount: result.data.amount,
      currency: result.data.currency,
      ok: true,
      response: result.data as unknown as Record<string, unknown>,
    };
  }
  return { ok: false, reason: 'unhealable_gateway' };
}
