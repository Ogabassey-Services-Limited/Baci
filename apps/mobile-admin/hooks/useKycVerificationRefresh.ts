import { useQueryClient } from '@tanstack/react-query';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
import { tryRefreshStoreReadiness } from '@/lib/try-refresh-store-readiness';

interface UseKycVerificationRefreshOptions {
  merchantId: string | null | undefined;
  refetchVerificationStatus: () => Promise<unknown>;
}

export function useKycVerificationRefresh({
  merchantId,
  refetchVerificationStatus,
}: UseKycVerificationRefreshOptions) {
  const queryClient = useQueryClient();

  async function refreshAfterVerification() {
    const normalizedMerchantId = merchantId?.trim();
    if (!normalizedMerchantId) {
      throw new Error('Merchant ID is required to refresh verification');
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['merchant'] }),
      queryClient.invalidateQueries({
        queryKey: ['verification-status', normalizedMerchantId],
      }),
      tryRefreshStoreReadiness(() =>
        invalidateStoreReadiness(queryClient, normalizedMerchantId)
      ),
    ]);

    await refetchVerificationStatus();
  }

  return {
    refreshAfterVerification,
  };
}
