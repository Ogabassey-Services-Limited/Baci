// Server-only access layer for the BYOK payment credential vault (see
// docs/payments/byok-payment-providers-plan.md Phase 0.2). The vault table
// (`private.merchant_payment_credentials`) is not exposed over PostgREST, so
// every read or write goes through one of the six SECURITY DEFINER RPCs
// created in supabase/migrations/20260708093415_merchant_payment_credentials.sql
// — all granted to service_role only. This module is the single place those
// RPCs get called from; callers never touch ciphertext or the admin client
// directly.
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
 * Records a successful provider validation for every stored role under a
 * provider and clears any prior validation error.
 */
export async function touchMerchantCredentialValidated(
  merchantId: string,
  provider: PaymentProvider
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    'touch_merchant_payment_credential_validated',
    {
      p_merchant_id: merchantId,
      p_provider: provider,
    }
  );

  assertNoRpcError(error, 'touch_merchant_payment_credential_validated');
}

/** Deletes every stored credential role for a merchant + provider pair. */
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
