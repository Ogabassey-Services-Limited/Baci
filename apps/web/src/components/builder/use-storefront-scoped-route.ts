import { useMerchantSafe } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';
import { getStorefrontScopedHref } from './storefront-scoping';

/**
 * Returns a function that scopes an href to the current merchant's storefront
 * basePath (when running inside `MerchantProvider`). Outside a merchant
 * context — or for anchors / external URLs — the input is returned unchanged.
 */
export function useStorefrontScopedRoute() {
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath;

  return (url: string) => asRoute(getStorefrontScopedHref(url, basePath));
}
