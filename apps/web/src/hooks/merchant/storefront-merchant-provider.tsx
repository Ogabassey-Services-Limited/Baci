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
}: MerchantProviderProps) {
  const routingMode = initialRoutingMode ?? 'path';
  const resolvedSlug = initialMerchant?.slug || slug || '';
  const basePath = routingMode === 'domain' ? '' : `/${resolvedSlug}`;

  return (
    <MerchantContext.Provider
      value={{
        merchant: initialMerchant,
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
        navigationCategories,
      }}
    >
      {children}
    </MerchantContext.Provider>
  );
}
