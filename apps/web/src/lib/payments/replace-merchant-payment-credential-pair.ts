import 'server-only';

import { encryptSecret } from '@/lib/crypto/secret-box';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  PaymentCredentialEnvironment,
  PaymentProvider,
} from './merchant-credentials';

interface ReplacePaymentCredentialPairInput {
  merchantId: string;
  provider: PaymentProvider;
  environment: PaymentCredentialEnvironment;
  clientId: string;
  secretKey: string;
}

/**
 * Replaces a credential pair through the database's serialized, transactional
 * pair-level RPC. Both roles commit or neither does; no app-level rollback can
 * race with another save.
 *
 * AUTHORIZATION: this calls a service-role-only RPC and performs no caller
 * authorization. The API route must verify settings.edit access first.
 */
export async function replaceMerchantPaymentCredentialPair(
  input: ReplacePaymentCredentialPairInput
): Promise<void> {
  const clientIdSecret = encryptSecret(input.clientId);
  const secretKeySecret = encryptSecret(input.secretKey);
  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    'replace_merchant_payment_credential_pair',
    {
      p_merchant_id: input.merchantId,
      p_provider: input.provider,
      p_environment: input.environment,
      p_client_id_ciphertext: clientIdSecret.ciphertext,
      p_client_id_kek_version: clientIdSecret.kekVersion,
      p_client_id_last4: input.clientId.slice(-4),
      p_secret_key_ciphertext: secretKeySecret.ciphertext,
      p_secret_key_kek_version: secretKeySecret.kekVersion,
      p_secret_key_last4: input.secretKey.slice(-4),
    }
  );

  if (error) {
    throw new Error('payment-credentials: atomic pair replacement failed', {
      cause: { code: error.code ?? 'UNKNOWN' },
    });
  }
}
