import { describe, expect, it, jest } from '@jest/globals';
import type { QueryClient } from '@tanstack/react-query';
import { warmCheckoutEntry } from './checkout-entry-prefetch';

const mockFetchMerchantPaymentSettings = jest.fn();
const mockFetchCheckoutShippingStates = jest.fn();

jest.mock('@/hooks/useMerchantPaymentSettings', () => ({
  fetchMerchantPaymentSettings: () => mockFetchMerchantPaymentSettings(),
  merchantPaymentSettingsQueryKey: [
    'merchant-payment-settings',
    'merchant-test-id',
  ],
}));

jest.mock('./checkout-screen.constants', () => ({
  CHECKOUT_API_BASE_URL: 'https://checkout.example',
}));

jest.mock('./checkout-shipping-requests', () => ({
  fetchCheckoutShippingStates: (apiBaseUrl: string) =>
    mockFetchCheckoutShippingStates(apiBaseUrl),
}));

describe('warmCheckoutEntry', () => {
  it('warms payment settings and shipping locations without blocking navigation', () => {
    const queryClient = {
      prefetchQuery: jest.fn(() => Promise.resolve()),
    } as unknown as Pick<QueryClient, 'prefetchQuery'>;
    mockFetchCheckoutShippingStates.mockResolvedValue(['Lagos'] as never);

    warmCheckoutEntry(queryClient);

    expect(queryClient.prefetchQuery).toHaveBeenCalledWith({
      queryFn: expect.any(Function),
      queryKey: ['merchant-payment-settings', 'merchant-test-id'],
      staleTime: 300_000,
    });
    expect(mockFetchCheckoutShippingStates).toHaveBeenCalledWith(
      'https://checkout.example'
    );
  });
});
