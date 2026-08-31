import type { SupabaseClient } from '@supabase/supabase-js';
import { jumiaAuthorizationCrypto } from '@/lib/jumia/authorization-crypto';
import type { JumiaSelfAuthorizationCredentials } from '@/schemas/jumia/self-authorization';
import { persistJumiaSelfAuthorizationRotation } from './persist-jumia-self-authorization-rotation';

type RotatedCredentials = JumiaSelfAuthorizationCredentials & {
  accessToken: string;
};

export async function persistRotatedJumiaCredentials(args: {
  credentials: RotatedCredentials;
  encryptionKey: string;
  supabase: SupabaseClient;
  merchantId: string;
  clientKeyHash: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}): Promise<string> {
  const credentialCiphertext = jumiaAuthorizationCrypto.encrypt(
    args.credentials,
    args.encryptionKey,
    jumiaAuthorizationCrypto.buildAuthorizationContext(
      args.merchantId,
      args.clientKeyHash
    )
  );
  await persistJumiaSelfAuthorizationRotation({
    supabase: args.supabase,
    merchantId: args.merchantId,
    clientKeyHash: args.clientKeyHash,
    credentialCiphertext,
    accessTokenExpiresAt: args.accessTokenExpiresAt,
    refreshTokenExpiresAt: args.refreshTokenExpiresAt,
  });
  return credentialCiphertext;
}
