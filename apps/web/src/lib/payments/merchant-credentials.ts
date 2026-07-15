// Server-only access layer for the BYOK payment credential vault (see
// docs/payments/byok-payment-providers-plan.md Phase 0.2). The vault table
// (`private.merchant_payment_credentials`) is not exposed over PostgREST, so
// every read or write goes through service-only SECURITY DEFINER RPCs. This
// module owns the remaining single-role RPCs;
// the colocated replace-merchant-payment-credential-pair module owns the only
// atomic pair RPC. Callers never touch ciphertext directly.
//
// AUTHORIZATION WARNING: every function below calls `createAdminClient()`
// (service_role). The RPCs themselves perform NO caller authorization —
// they trust their inputs completely, and `auth.uid()` is NULL under
// service_role, so RLS-based ownership checks do not apply here. This
// module never verifies that the caller is allowed to act on `merchantId`.
// Every API route that calls into this module MUST first check
// merchant-staff authorization for that merchant (e.g. `hasPermission(access,
// 'settings', 'edit')` / the equivalent `check_staff_permission()` gate)
// before invoking any function here. Skipping that check lets any
// authenticated caller read or overwrite another merchant's credentials.
import 'server-only';

import { decryptSecret, encryptSecret } from '@/lib/crypto/secret-box';
import { createAdminClient } from '@/lib/supabase/admin';

export type PaymentProvider =
  | 'paypal'
  | 'stripe'
  | 'flutterwave'
  | 'paystack'
  | 'razorpay';

export type PaymentCredentialRole =
  | 'client_id'
  | 'secret_key'
  | 'webhook_secret'
  | 'connect_account_id'
  | 'public_key';

export type PaymentCredentialEnvironment = 'test' | 'live';

export interface MerchantPaymentCredentialMetaRow {
  credential_role: PaymentCredentialRole;
  disabled_at: string | null;
  environment: PaymentCredentialEnvironment;
  is_active: boolean;
  key_last4: string | null;
  last_validated_at: string | null;
  last_validation_error: string | null;
}

interface MerchantPaymentCredentialCiphertextRow {
  ciphertext: string;
  kek_version: number;
}

interface RpcErrorLike {
  message: string;
}

/** Throws a descriptive, secret-free error whenever an RPC call errors. */
function assertNoRpcError(error: RpcErrorLike | null, rpcName: string): void {
  if (error) {
    throw new Error(
      `merchant-credentials: ${rpcName} failed: ${error.message}`
    );
  }
}

/**
 * Encrypts `plaintext` and upserts it into the vault for one
 * (merchant, provider, credential_role, environment) slot. Reactivates the
 * slot server-side if it had previously been disabled. Returns the vault
 * row id.
 *
 * AUTHORIZATION: calls the service_role-only RPC directly and performs no
 * caller authorization itself. The calling API route MUST verify the
 * caller has staff/owner access to `merchantId` (e.g.
 * `hasPermission(access, 'settings', 'edit')`) before calling this.
 */
export async function setMerchantPaymentCredential(
  merchantId: string,
  provider: PaymentProvider,
  role: PaymentCredentialRole,
  environment: PaymentCredentialEnvironment,
  plaintext: string
): Promise<string> {
  const { ciphertext, kekVersion } = encryptSecret(plaintext);
  const keyLast4 = plaintext.slice(-4);

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    'set_merchant_payment_credential',
    {
      p_merchant_id: merchantId,
      p_provider: provider,
      p_credential_role: role,
      p_environment: environment,
      p_ciphertext: ciphertext,
      p_kek_version: kekVersion,
      p_key_last4: keyLast4,
    }
  );

  assertNoRpcError(error, 'set_merchant_payment_credential');

  const credentialId = data as string | null;
  if (!credentialId) {
    throw new Error(
      'merchant-credentials: set_merchant_payment_credential returned no credential id.'
    );
  }

  return credentialId;
}

/**
 * Returns redacted metadata (never ciphertext) for every credential role a
 * merchant has stored for a provider. Never calls the decrypt path.
 */
export async function getMerchantPaymentCredentialMeta(
  merchantId: string,
  provider: PaymentProvider
): Promise<MerchantPaymentCredentialMetaRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    'get_merchant_payment_credential_meta',
    {
      p_merchant_id: merchantId,
      p_provider: provider,
    }
  );

  assertNoRpcError(error, 'get_merchant_payment_credential_meta');

  return (data as MerchantPaymentCredentialMetaRow[] | null) ?? [];
}

/**
 * Reads and decrypts one credential role. Fails closed: throws on an RPC
 * error, on zero active rows (revoked/never-set credential), and on a
 * decrypt failure — there is no platform-key fallback anywhere in this path.
 */
export async function getDecryptedMerchantCredential(
  merchantId: string,
  provider: PaymentProvider,
  role: PaymentCredentialRole,
  environment: PaymentCredentialEnvironment
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    'get_merchant_payment_credential_ciphertext',
    {
      p_merchant_id: merchantId,
      p_provider: provider,
      p_credential_role: role,
      p_environment: environment,
    }
  );

  assertNoRpcError(error, 'get_merchant_payment_credential_ciphertext');

  const rows = (data as MerchantPaymentCredentialCiphertextRow[] | null) ?? [];
  const row = rows[0];
  if (!row) {
    throw new Error(
      `merchant-credentials: no active ${role} credential for provider ${provider} (${environment}).`
    );
  }

  return decryptSecret(row.ciphertext, row.kek_version);
}

/**
 * Disables a credential role after a failed validation or provider
 * rejection, e.g. a 401 from the provider mid-flight.
 */
export async function markMerchantCredentialInvalid(
  merchantId: string,
  provider: PaymentProvider,
  role: PaymentCredentialRole,
  environment: PaymentCredentialEnvironment,
  errorMessage: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    'mark_merchant_payment_credential_invalid',
    {
      p_merchant_id: merchantId,
      p_provider: provider,
      p_credential_role: role,
      p_environment: environment,
      p_error: errorMessage,
    }
  );

  assertNoRpcError(error, 'mark_merchant_payment_credential_invalid');
}

/**
 * Deletes every stored credential role for a merchant + provider pair.
 *
 * AUTHORIZATION: calls the service_role-only RPC directly and performs no
 * caller authorization itself. The calling API route MUST verify the
 * caller has staff/owner access to `merchantId` (e.g.
 * `hasPermission(access, 'settings', 'edit')`) before calling this.
 */
export async function deleteMerchantCredentials(
  merchantId: string,
  provider: PaymentProvider
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc('delete_merchant_payment_credential', {
    p_merchant_id: merchantId,
    p_provider: provider,
  });

  assertNoRpcError(error, 'delete_merchant_payment_credential');
}

/**
 * Deletes ONE (merchant, provider, role, environment) vault slot. Used to roll
 * back a single failed credential save without wiping the merchant's other
 * environments/roles (payment-credentials:204).
 *
 * AUTHORIZATION: calls the service_role-only RPC directly and performs no
 * caller authorization itself. The calling API route MUST verify staff/owner
 * access to `merchantId` before calling this.
 */
export async function deleteMerchantCredential(
  merchantId: string,
  provider: PaymentProvider,
  role: PaymentCredentialRole,
  environment: PaymentCredentialEnvironment
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    'delete_merchant_payment_credential_role',
    {
      p_merchant_id: merchantId,
      p_provider: provider,
      p_credential_role: role,
      p_environment: environment,
    }
  );

  assertNoRpcError(error, 'delete_merchant_payment_credential_role');
}
