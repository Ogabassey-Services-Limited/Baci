import type { QueryClient } from '@tanstack/react-query';
import {
  fetchMerchantPaymentSettings,
  merchantPaymentSettingsQueryKey,
} from '@/hooks/useMerchantPaymentSettings';
import { CHECKOUT_API_BASE_URL } from './checkout-screen.constants';
import { fetchCheckoutShippingStates } from './checkout-shipping-requests';

const CHECKOUT_PREFETCH_STALE_MS = 5 * 60 * 1000;

export function warmCheckoutEntry(
  queryClient: Pick<QueryClient, 'prefetchQuery'>
): void {
  void queryClient
    .prefetchQuery({
      queryKey: merchantPaymentSettingsQueryKey,
      queryFn: fetchMerchantPaymentSettings,
      staleTime: CHECKOUT_PREFETCH_STALE_MS,
    })
    .catch(() => undefined);

  void fetchCheckoutShippingStates(CHECKOUT_API_BASE_URL).catch(
    () => undefined
  );
}
