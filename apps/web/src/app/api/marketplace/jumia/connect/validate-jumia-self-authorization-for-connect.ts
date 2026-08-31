import type { SupabaseClient } from '@supabase/supabase-js';
import { validateJumiaSelfAuthorization } from '@/lib/jumia/self-authorization';
import type { JumiaSelfAuthorizationCredentials } from '@/schemas/jumia/self-authorization';
import { claimJumiaResumedAuthorization } from './claim-jumia-resumed-authorization';
import { persistRotatedJumiaCredentials } from './persist-rotated-jumia-credentials';
import { persistRotatedJumiaCredentialsWithLease } from './persist-rotated-jumia-credentials-with-lease';

type ValidatedSelfAuthorization = Awaited<
  ReturnType<typeof validateJumiaSelfAuthorization>
>;

export async function validateJumiaSelfAuthorizationForConnect(args: {
  clientKeyHash: string;
  discoveryId?: string;
  encryptionKey: string;
  merchantId: string;
  onCredentialsRotated: (credentialCiphertext: string) => Promise<void>;
  submittedCredentials: JumiaSelfAuthorizationCredentials;
  supabase: SupabaseClient;
}): Promise<ValidatedSelfAuthorization> {
  const authorizationLease = await claimJumiaResumedAuthorization({
    clientKeyHash: args.clientKeyHash,
    encryptionKey: args.encryptionKey,
    merchantId: args.merchantId,
    supabase: args.supabase,
  });
  const submittedCredentials =
    authorizationLease?.credentials ?? args.submittedCredentials;

  return validateJumiaSelfAuthorization(submittedCredentials, {
    onCredentialsRotated: async ({
      credentials,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    }) => {
      const credentialCiphertext = authorizationLease
        ? await persistRotatedJumiaCredentialsWithLease({
            authorizationId: authorizationLease.authorizationId,
            authorizationRotationVersion:
              authorizationLease.authorizationRotationVersion,
            clientKeyHash: args.clientKeyHash,
            credentials,
            encryptionKey: args.encryptionKey,
            merchantId: args.merchantId,
            refreshLeaseToken: authorizationLease.leaseToken,
            refreshTokenExpiresAt,
            supabase: args.supabase,
            accessTokenExpiresAt,
          })
        : await persistRotatedJumiaCredentials({
            credentials,
            encryptionKey: args.encryptionKey,
            supabase: args.supabase,
            merchantId: args.merchantId,
            clientKeyHash: args.clientKeyHash,
            accessTokenExpiresAt,
            refreshTokenExpiresAt,
          });
      await args.onCredentialsRotated(credentialCiphertext);
    },
  });
}
