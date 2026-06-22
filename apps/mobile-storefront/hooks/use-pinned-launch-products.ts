import { useQuery } from '@tanstack/react-query';
import { CONSTANT_MERCHANT_ID } from '@/hooks/product-utils';
import { useMerchant } from '@/hooks/use-merchant';
import { fetchProductsBySlugs } from './product-by-slugs';

/**
 * React Query hook for the deterministic launch-carousel pins. Scoped to the
 * active merchant and disabled when there are no slugs to fetch.
 */
export function usePinnedLaunchProducts(slugs: readonly string[]) {
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  return useQuery({
    // Keyed under the shared ['products', merchantId, …] hierarchy so the home
    // pull-to-refresh (which resets ['products', merchantId]) also refreshes the
    // launch carousel — otherwise edited/deactivated pins could stay stale.
    queryKey: ['products', merchantId, 'launch-by-slugs', slugs],
    queryFn: () => fetchProductsBySlugs(merchantId, slugs),
    staleTime: 1000 * 60 * 2,
    enabled: Boolean(merchantId) && slugs.length > 0,
  });
}
