import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { StorefrontMerchantProvider } from './storefront-merchant-provider';
import { useMerchant } from './use-merchant';

describe('StorefrontMerchantProvider', () => {
  it('provides server-resolved storefront merchant data without loading state', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StorefrontMerchantProvider
        shellSnapshot={{
          merchant: {
            id: 'merchant-1',
            user_id: '',
            business_name: 'Ogabassey',
            business_type: 'gadgets',
            slug: 'ogabassey',
          },
          routingMode: 'path',
          basePath: '/ogabassey',
          navigationCategories: [{ name: 'Phones', slug: 'phones' }],
        }}
      >
        {children}
      </StorefrontMerchantProvider>
    );

    const { result } = renderHook(() => useMerchant(), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.basePath).toBe('/ogabassey');
    expect(result.current.merchant?.business_name).toBe('Ogabassey');
    expect(result.current.navigationCategories).toEqual([
      { name: 'Phones', slug: 'phones' },
    ]);
  });

  it('uses an empty basePath for domain-routed storefronts', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StorefrontMerchantProvider
        shellSnapshot={{
          merchant: {
            id: 'merchant-1',
            user_id: '',
            business_name: 'Ogabassey',
            business_type: 'gadgets',
            slug: 'ogabassey',
          },
          routingMode: 'domain',
          basePath: '',
          navigationCategories: [],
        }}
      >
        {children}
      </StorefrontMerchantProvider>
    );

    const { result } = renderHook(() => useMerchant(), { wrapper });

    expect(result.current.basePath).toBe('');
    expect(result.current.routingMode).toBe('domain');
  });
});
