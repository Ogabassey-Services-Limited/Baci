import { useQuery } from '@tanstack/react-query';
import { storeReadinessOptions } from '@/lib/store-readiness-query';
import { useMerchant } from './useMerchant';

export function useStoreReadiness() {
  const {
    merchant,
    isLoading: isMerchantLoading,
    isFetching: isMerchantFetching,
    error: merchantError,
    refetch: refetchMerchant,
  } = useMerchant();
  const query = useQuery({
    ...storeReadinessOptions(merchant?.id ?? 'unresolved'),
    enabled: Boolean(merchant?.id),
  });

  function refetch() {
    if (merchant?.id) {
      return query.refetch();
    }

    return refetchMerchant();
  }

  return {
    readiness: query.data,
    isLoading: isMerchantLoading || query.isLoading,
    isFetching: isMerchantFetching || query.isFetching,
    error: merchantError ?? query.error,
    refetch,
  };
}
