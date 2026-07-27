import { useQueryClient } from '@tanstack/react-query';
import { getFollowUpViewState } from '@/components/customers/follow-up-view-state';
import { useFailedOrders } from '@/hooks/useFailedOrders';
import { useMerchant } from '@/hooks/useMerchant';

/**
 * Coordinates the Customers > Follow Up merchant context and queue query.
 * A missing merchant disables the queue query, so all refresh affordances must
 * refresh merchant context first rather than treating the queue as empty.
 */
export function useFollowUpQueue() {
  const queryClient = useQueryClient();
  const {
    merchant,
    isLoading: isMerchantLoading,
    error: merchantError,
  } = useMerchant();
  const {
    data: failedOrders,
    isError: isFailedOrdersError,
    isFetching: isFetchingFailed,
    isLoading: isLoadingFailed,
    refetch: refetchFailed,
  } = useFailedOrders();

  const viewState = getFollowUpViewState({
    followUpCount: failedOrders?.length ?? 0,
    hasMerchant: Boolean(merchant?.id),
    isFollowUpError: isFailedOrdersError,
    isFollowUpLoading: isLoadingFailed,
    isMerchantLoading,
    merchantError: merchantError instanceof Error ? merchantError : null,
  });

  const refresh = async () => {
    const refreshes: Promise<unknown>[] = [
      queryClient.invalidateQueries({ queryKey: ['merchant'] }),
    ];

    if (merchant?.id) {
      refreshes.push(refetchFailed());
    }

    await Promise.allSettled(refreshes);
  };

  return {
    failedOrders,
    isFailedOrdersError,
    isFetchingFailed,
    isLoadingFailed,
    merchant,
    refresh,
    viewState,
  };
}
