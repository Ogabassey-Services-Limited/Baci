import { useQueryClient } from '@tanstack/react-query';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';

interface UseKycVerificationRefreshOptions {
  merchantId: string;
  refetchVerificationStatus: () => Promise<unknown>;
}

export function useKycVerificationRefresh({
  merchantId,
  refetchVerificationStatus,
}: UseKycVerificationRefreshOptions) {
  const queryClient = useQueryClient();

  async function refreshAfterVerification() {
    if (!merchantId.trim()) {
      throw new Error('Merchant ID is required to refresh verification');
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['merchant'] }),
      queryClient.invalidateQueries({
        queryKey: ['verification-status', merchantId],
      }),
      invalidateStoreReadiness(queryClient, merchantId),
    ]);

    await refetchVerificationStatus();
  }

  return {
    refreshAfterVerification,
  };
}
