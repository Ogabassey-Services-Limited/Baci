import { useQuery } from '@tanstack/react-query';
import { storeReadinessOptions } from '@/lib/store-readiness-query';
import { useMerchant } from './useMerchant';

const UNRESOLVED_MERCHANT_ID = 'unresolved';

export function useStoreReadiness() {
  const {
    merchant,
    isLoading: isMerchantLoading,
    isFetching: isMerchantFetching,
    error: merchantError,
    refetch: refetchMerchant,
  } = useMerchant();
  const query = useQuery({
    ...storeReadinessOptions(merchant?.id ?? UNRESOLVED_MERCHANT_ID),
    enabled: Boolean(merchant?.id),
  });

  async function refetch(): Promise<void> {
    if (merchant?.id) {
      await query.refetch();
      return;
    }

    await refetchMerchant();
  }

  return {
    readiness: query.data,
    isLoading: isMerchantLoading || query.isLoading,
    isFetching: isMerchantFetching || query.isFetching,
    error: merchantError ?? query.error,
    refetch,
  };
}
