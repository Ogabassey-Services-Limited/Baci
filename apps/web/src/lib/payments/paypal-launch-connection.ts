import 'server-only';

import { logger } from '@/lib/logger';
import {
  getMerchantPaymentCredentialMeta,
  type PaymentCredentialEnvironment,
} from './merchant-credentials';
import { readPaypalFeatureConfig } from './paypal-checkout-credentials';

/**
 * Launch-readiness check for the PayPal BYOK lane (Wave 2, see
 * docs/payments/byok-payment-providers-plan.md Phase 2 item 10): "connect
 * PayPal (or another provider) or enable Pay-on-Delivery" replaces the old
 * "non-NG merchants have no online option" launch gate. This is deliberately
 * stricter than a bare "is a secret stored" check — it requires a **live**,
 * validated connection, mirroring the checkout-time bar (Phase 2 item 8:
 * "enabled + validated live credential"). A merchant who has only pasted
 * sandbox credentials cannot actually take a real customer payment yet, so
 * sandbox mode must never satisfy the launch requirement.
 *
 * Fails closed: any vault read error is treated as "not connected" rather
 * than risking a false "ready to launch" signal.
 */
export async function isPaypalConnectionValidForLaunch(
  merchantId: string,
  customSettings: Record<string, unknown> | null | undefined
): Promise<boolean> {
  const { enabled, environment } = readPaypalFeatureConfig(customSettings);
  if (!enabled || environment !== 'live') {
    return false;
  }

  try {
    const meta = await getMerchantPaymentCredentialMeta(merchantId, 'paypal');
    return (
      hasActiveValidatedRole(meta, 'client_id', environment) &&
      hasActiveValidatedRole(meta, 'secret_key', environment)
    );
  } catch (error) {
    logger.warn({
      message: 'PayPal launch-readiness credential check failed',
      merchantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function hasActiveValidatedRole(
  meta: Awaited<ReturnType<typeof getMerchantPaymentCredentialMeta>>,
  role: 'client_id' | 'secret_key',
  environment: PaymentCredentialEnvironment
): boolean {
  return meta.some(
    (row) =>
      row.credential_role === role &&
      row.environment === environment &&
      row.is_active &&
      row.last_validated_at !== null
  );
}
