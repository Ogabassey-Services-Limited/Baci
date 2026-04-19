import { render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { StorefrontMerchantProvider } from '@/hooks/merchant/storefront-merchant-provider';
import { useMerchant } from '@/hooks/merchant/use-merchant';

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

  it('provides navigationCategories to route content before suspended chrome resolves', () => {
    const suspendedChromePromise = new Promise<never>(() => {
      // Keep chrome suspended to verify content gets first-render categories.
    });

    function SuspendedChrome(): ReactNode {
      throw suspendedChromePromise;
    }

    function RouteContentConsumer() {
      const merchant = useMerchant();

      return (
        <div>{merchant.navigationCategories.map((item) => item.name)}</div>
      );
    }

    render(
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
        <Suspense
          fallback={
            <div role="status" aria-label="Loading storefront chrome">
              chrome
            </div>
          }
        >
          <SuspendedChrome />
        </Suspense>
        <RouteContentConsumer />
      </StorefrontMerchantProvider>
    );

    expect(
      screen.getByRole('status', { name: 'Loading storefront chrome' })
    ).toBeInTheDocument();
    expect(screen.getByText('Phones')).toBeInTheDocument();
  });
});
