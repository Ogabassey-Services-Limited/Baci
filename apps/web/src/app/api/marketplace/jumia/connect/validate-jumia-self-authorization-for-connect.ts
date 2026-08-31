import type { SupabaseClient } from '@supabase/supabase-js';
import { releaseJumiaAuthorizationRefreshLease } from '@/lib/jumia/jumia-authorization-refresh-lease';
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
  onCredentialsRotated: (value: {
    credentialCiphertext: string;
    expectedRotationVersion?: number;
  }) => Promise<void>;
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

  let credentialsRotated = false;
  try {
    return await validateJumiaSelfAuthorization(submittedCredentials, {
      onCredentialsRotated: async ({
        credentials,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
      }) => {
        const persisted = authorizationLease
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
        // The lease-protected RPC clears the lease before the outer callback
        // runs. Only failures before that point need an explicit release.
        credentialsRotated = true;
        await args.onCredentialsRotated(persisted);
      },
    });
  } catch (error) {
    if (authorizationLease && !credentialsRotated) {
      try {
        await releaseJumiaAuthorizationRefreshLease({
          authorizationId: authorizationLease.authorizationId,
          merchantId: args.merchantId,
          leaseToken: authorizationLease.leaseToken,
          supabase: args.supabase,
        });
      } catch (releaseError) {
        console.error(
          '[Jumia Connect] Failed to release refresh lease after validation failure:',
          releaseError
        );
      }
    }
    throw error;
  }
}
