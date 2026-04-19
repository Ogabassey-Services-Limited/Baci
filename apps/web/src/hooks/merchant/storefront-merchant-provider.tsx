'use client';

import { defaultStaffAccess } from './constants';
import { MerchantContext } from './merchant-context';
import type { MerchantProviderProps } from './types';

export function StorefrontMerchantProvider({
  children,
  slug,
  initialMerchant = null,
  initialRoutingMode,
  navigationCategories = [],
  shellSnapshot = null,
}: MerchantProviderProps) {
  const merchant = shellSnapshot?.merchant ?? initialMerchant;
  const routingMode =
    shellSnapshot?.routingMode ?? initialRoutingMode ?? 'path';
  const resolvedSlug = merchant?.slug ?? slug ?? '';
  const basePath =
    shellSnapshot?.basePath ??
    (routingMode === 'domain' ? '' : `/${resolvedSlug}`);
  const resolvedNavigationCategories =
    shellSnapshot?.navigationCategories ?? navigationCategories;

  return (
    <MerchantContext.Provider
      value={{
        merchant,
        loading: false,
        updateMerchant: () => {
          throw new Error(
            'Merchant updates are unavailable in storefront context.'
          );
        },
        reloadMerchant: () => undefined,
        staffAccess: defaultStaffAccess,
        hasPermission: () => false,
        routingMode,
        basePath,
        navigationCategories: resolvedNavigationCategories,
      }}
    >
      {children}
    </MerchantContext.Provider>
  );
}
