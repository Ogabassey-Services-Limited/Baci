import { useQueryClient } from '@tanstack/react-query';

interface UseKycVerificationRefreshOptions {
  merchantId?: string | null;
  refetchVerificationStatus: () => Promise<unknown>;
}

export function useKycVerificationRefresh({
  merchantId,
  refetchVerificationStatus,
}: UseKycVerificationRefreshOptions) {
  const queryClient = useQueryClient();

  async function refreshAfterVerification() {
    // Store readiness is derived from merchant cache fields (nin/bvn/cac_rc_number),
    // so the merchant refetch must settle before readiness is recomputed — otherwise
    // readiness may resolve against stale KYC data and hide the publish CTA until a
    // later manual refresh.
    await queryClient.invalidateQueries({ queryKey: ['merchant'] });

    const invalidations: Promise<unknown>[] = [
      queryClient.invalidateQueries({ queryKey: ['store-readiness'] }),
    ];

    if (merchantId) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: ['verification-status', merchantId],
        })
      );
    }

    await Promise.all(invalidations);

    await refetchVerificationStatus();
  }

  return {
    refreshAfterVerification,
  };
}
