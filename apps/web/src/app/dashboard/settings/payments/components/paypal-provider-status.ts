/**
 * Types and pure helpers shared by the PayPal BYOK connection card
 * (`paypal-provider-card.tsx`) and its request layer
 * (`paypal-provider-requests.ts`). Mirrors the write-only status shape
 * returned by `/api/merchant/payment-credentials`
 * (see docs/payments/byok-payment-providers-plan.md Phase 2).
 */

export type PaypalMode = 'sandbox' | 'live';
export type PaypalVaultEnvironment = 'test' | 'live';

export interface PaymentCredentialRoleView {
  role:
    | 'client_id'
    | 'secret_key'
    | 'webhook_secret'
    | 'connect_account_id'
    | 'public_key';
  environment: PaypalVaultEnvironment;
  last4: string | null;
  isActive: boolean;
  lastValidatedAt: string | null;
  lastValidationError: string | null;
}

export interface PaymentCredentialStatusResponse {
  configured: boolean;
  roles: PaymentCredentialRoleView[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The `paypal_mode` feature flag maps 1:1 to the vault's environment slot. */
export function toVaultEnvironment(mode: PaypalMode): PaypalVaultEnvironment {
  return mode === 'live' ? 'live' : 'test';
}

/** Finds one (role, environment) row in a status response, or `null`. */
export function findRole(
  status: PaymentCredentialStatusResponse | null,
  role: PaymentCredentialRoleView['role'],
  environment: PaypalVaultEnvironment
): PaymentCredentialRoleView | null {
  return (
    status?.roles.find(
      (candidate) =>
        candidate.role === role && candidate.environment === environment
    ) ?? null
  );
}

/**
 * Whether a given PayPal mode is fully connected: both the client ID and secret
 * are active and the secret carries no outstanding validation error. This is
 * the same gate the storefront must satisfy before offering PayPal, so the
 * settings card uses it to avoid persisting `paypal_enabled` for a mode whose
 * credentials are missing or rejected.
 */
export function isModeConnected(
  status: PaymentCredentialStatusResponse | null,
  mode: PaypalMode
): boolean {
  const environment = toVaultEnvironment(mode);
  const secretRole = findRole(status, 'secret_key', environment);
  const clientRole = findRole(status, 'client_id', environment);
  return Boolean(
    secretRole?.isActive &&
      clientRole?.isActive &&
      !secretRole?.lastValidationError
  );
}
