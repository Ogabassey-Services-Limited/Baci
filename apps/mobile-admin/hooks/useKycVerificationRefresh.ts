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
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: ['merchant'] }),
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
