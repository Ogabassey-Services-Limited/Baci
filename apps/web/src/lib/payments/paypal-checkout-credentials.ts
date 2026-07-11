import 'server-only';

import { logger } from '@/lib/logger';
import type { PayPalMode } from '@/lib/paypal';
import {
  getDecryptedMerchantCredential,
  markMerchantCredentialInvalid,
  type PaymentCredentialEnvironment,
} from './merchant-credentials';
import { disablePaypalFeatureFlag } from './paypal-feature-flag';

/**
 * Credential-sourcing helpers for the PayPal BYOK checkout routes (Wave 2, see
 * docs/payments/byok-payment-providers-plan.md Phase 2, items 1 & 6). These
 * replace the prototype's plaintext `custom_settings.paypal_client_id/
 * paypal_secret_key` reads with the encrypted vault
 * (lib/payments/merchant-credentials.ts). The non-secret toggle/mode config
 * (`paypal_enabled`, `paypal_mode`) intentionally stays in
 * `merchant_feature_settings.custom_settings` (Phase 2 item 2).
 *
 * Fail-closed everywhere: a vault miss (never-set or revoked credential) or an
 * RPC error yields `null`, and the calling route maps that to a 400
 * `paypal_not_configured`. There is no platform-key fallback in this path.
 */

export interface PaypalFeatureConfig {
  enabled: boolean;
  mode: PayPalMode;
  /** The vault environment slot the mode toggle maps to ('sandbox' -> 'test'). */
  environment: PaymentCredentialEnvironment;
}

export interface PaypalCheckoutCredentials {
  clientId: string;
  secretKey: string;
}

/**
 * Reads the merchant's non-secret PayPal config from a
 * `merchant_feature_settings.custom_settings` blob. `paypal_mode` maps to the
 * vault environment: 'live' -> 'live', anything else (incl. missing) ->
 * 'sandbox'/'test'.
 */
export function readPaypalFeatureConfig(
  customSettings: Record<string, unknown> | null | undefined
): PaypalFeatureConfig {
  const enabled = customSettings?.paypal_enabled === true;
  const mode: PayPalMode =
    customSettings?.paypal_mode === 'live' ? 'live' : 'sandbox';
  return {
    enabled,
    mode,
    environment: mode === 'live' ? 'live' : 'test',
  };
}

/**
 * Fetches and decrypts both PayPal credential roles (client_id + secret_key)
 * for a merchant at the given environment. Returns `null` if either role is
 * missing/revoked or an RPC error occurs — the route fails closed on `null`.
 * Awaited sequentially so a rejection never leaves a second promise unhandled.
 */
export async function getPaypalCheckoutCredentials(
  merchantId: string,
  environment: PaymentCredentialEnvironment
): Promise<PaypalCheckoutCredentials | null> {
  try {
    const clientId = await getDecryptedMerchantCredential(
      merchantId,
      'paypal',
      'client_id',
      environment
    );
    const secretKey = await getDecryptedMerchantCredential(
      merchantId,
      'paypal',
      'secret_key',
      environment
    );
    return { clientId, secretKey };
  } catch (error) {
    logger.warn({
      message: 'PayPal checkout credentials unavailable in vault',
      merchantId,
      environment,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Fetches only the (browser-safe) client_id role — used by the client-token
 * route, which never needs the secret. Returns `null` on miss/error.
 */
export async function getPaypalClientId(
  merchantId: string,
  environment: PaymentCredentialEnvironment
): Promise<string | null> {
  try {
    return await getDecryptedMerchantCredential(
      merchantId,
      'paypal',
      'client_id',
      environment
    );
  } catch (error) {
    logger.warn({
      message: 'PayPal client_id unavailable in vault',
      merchantId,
      environment,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * True when a PayPal library result code signals an authentication failure —
 * i.e. the merchant's stored credentials are no longer valid (revoked/rotated).
 * The lib surfaces PayPal's HTTP status as `HTTP_<status>` on OAuth failures.
 */
export function isPaypalAuthFailure(code: string | undefined): boolean {
  return code === 'HTTP_401';
}

/**
 * Handles a PayPal credential rejection (401/invalid) discovered mid-checkout
 * (Phase 2 item 1, C-143). Two best-effort side effects, each isolated so one
 * failure never masks the other or the 400 the route is about to return:
 *   1. mark the stored secret_key credential invalid, and
 *   2. clear the non-secret `paypal_enabled` flag so checkout stops advertising
 *      PayPal to customers — otherwise they keep hitting the same failure until a
 *      merchant manually reconnects.
 * Clearing the flag reuses the service-role feature-settings path the disconnect
 * route uses (`disablePaypalFeatureFlag`); under checkout there is no
 * `auth.uid()`, so an RLS-scoped update would match zero rows.
 */
export async function markPaypalCredentialInvalid(
  merchantId: string,
  environment: PaymentCredentialEnvironment,
  errorMessage: string
): Promise<void> {
  try {
    await markMerchantCredentialInvalid(
      merchantId,
      'paypal',
      'secret_key',
      environment,
      errorMessage
    );
  } catch (error) {
    logger.error({
      message: 'Failed to mark PayPal credential invalid after 401',
      merchantId,
      environment,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await disablePaypalFeatureFlag(merchantId);
  } catch (error) {
    logger.error({
      message: 'Failed to clear paypal_enabled after credential rejection',
      merchantId,
      environment,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
