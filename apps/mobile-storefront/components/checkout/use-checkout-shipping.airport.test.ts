import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { UseFormSetValue } from 'react-hook-form';
import type { ShippingAddressInput } from '@/lib/validation';
import type { CartItem } from '@/stores/cart-store';
import type { FetchQuotesArgs } from './checkout-shipping.helpers';
import { useCheckoutShipping } from './use-checkout-shipping';

const mockFetchShippingQuotes =
  jest.fn<(args: FetchQuotesArgs) => Promise<void>>();

jest.mock('./checkout-shipping-loaders', () => ({
  loadShippingCities: jest.fn(),
  loadShippingStates: jest.fn(),
}));

jest.mock('./checkout-shipping.helpers', () => ({
  ...jest.requireActual<typeof import('./checkout-shipping.helpers')>(
    './checkout-shipping.helpers'
  ),
  fetchShippingQuotes: (args: FetchQuotesArgs) => mockFetchShippingQuotes(args),
}));

const item: CartItem = {
  id: 'line-1',
  name: 'iPhone 13',
  price: 500_000,
  product_id: 'product-1',
  quantity: 1,
  slug: 'iphone-13',
};
const items = [item];

describe('useCheckoutShipping airport switching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchShippingQuotes.mockImplementation((args) => {
      args.setIsLoadingQuotes(true);
      args.setShippingQuotes([
        {
          displayName: 'GIG Logistics - Home Delivery',
          id: 'road-quote',
          price: 5_659,
          provider: 'GIGL',
        },
      ]);
      args.setSelectedQuoteId('road-quote');
      args.setResolvedShippingQuoteContextKey(args.quoteContextKey);
      args.setIsLoadingQuotes(false);
      return Promise.resolve();
    });
  });

  it('reuses resolved road quotes after switching to air and back', async () => {
    const setValue = jest.fn() as jest.MockedFunction<
      UseFormSetValue<ShippingAddressInput>
    >;
    const { result } = renderHook(() =>
      useCheckoutShipping({
        apiBaseUrl: 'https://api.example.com',
        customer: null,
        items,
        setValue,
        watchedAddress: '1 Airport Road, Port Harcourt',
        watchedCity: 'Port Harcourt',
        watchedEmail: 'customer@example.com',
        watchedFirstName: 'Ada',
        watchedLastName: 'Lovelace',
        watchedPhone: '08012345678',
        watchedState: 'Rivers',
      })
    );

    await waitFor(() =>
      expect(result.current.selectedQuoteId).toBe('road-quote')
    );
    expect(mockFetchShippingQuotes).toHaveBeenCalledTimes(1);

    act(() => result.current.handleSelectDeliveryMethod('airport'));
    expect(result.current.shippingQuotes).toHaveLength(1);

    act(() => result.current.handleSelectDeliveryMethod('door'));
    await act(async () => Promise.resolve());

    expect(result.current.selectedQuoteId).toBe('road-quote');
    expect(result.current.shippingQuotes).toHaveLength(1);
    expect(mockFetchShippingQuotes).toHaveBeenCalledTimes(1);
  });
});
