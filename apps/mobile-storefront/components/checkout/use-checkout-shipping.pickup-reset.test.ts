import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { UseFormSetValue } from 'react-hook-form';
import type { FetchQuotesArgs } from '@/components/checkout/checkout-shipping.helpers';
import type { ShippingAddressInput } from '@/lib/validation';
import type { CartItem } from '@/stores/cart-store';
import { useCheckoutShipping } from './use-checkout-shipping';

const mockFetchStates = jest.fn<(apiBaseUrl: string) => Promise<string[]>>();
const mockFetchCities =
  jest.fn<
    (
      apiBaseUrl: string,
      state: string,
      signal: AbortSignal
    ) => Promise<string[]>
  >();
const mockFetchShippingQuotes =
  jest.fn<(args: FetchQuotesArgs) => Promise<void>>();

jest.mock('./checkout-shipping-requests', () => ({
  fetchCheckoutShippingCities: (
    apiBaseUrl: string,
    state: string,
    signal: AbortSignal
  ) => mockFetchCities(apiBaseUrl, state, signal),
  fetchCheckoutShippingStates: (apiBaseUrl: string) =>
    mockFetchStates(apiBaseUrl),
}));

jest.mock('@/components/checkout/checkout-shipping.helpers', () => ({
  ...jest.requireActual<
    typeof import('@/components/checkout/checkout-shipping.helpers')
  >('@/components/checkout/checkout-shipping.helpers'),
  fetchShippingQuotes: (args: FetchQuotesArgs) => mockFetchShippingQuotes(args),
}));

const mockSetValue = jest.fn() as jest.MockedFunction<
  UseFormSetValue<ShippingAddressInput>
>;

const items: CartItem[] = [
  {
    id: 'line-1',
    name: 'iPhone 13',
    price: 500_000,
    product_id: 'product-1',
    quantity: 1,
    slug: 'iphone-13',
  },
];

type ShippingParams = Parameters<typeof useCheckoutShipping>[0];

function createParams(overrides: Partial<ShippingParams> = {}): ShippingParams {
  return {
    apiBaseUrl: 'https://api.example.com',
    customer: null,
    items,
    setValue: mockSetValue,
    watchedAddress: '',
    watchedCity: 'Ikeja',
    watchedEmail: '',
    watchedFirstName: '',
    watchedLastName: '',
    watchedPhone: '',
    watchedState: 'Lagos',
    ...overrides,
  };
}

describe('useCheckoutShipping pickup station reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchStates.mockResolvedValue(['Lagos']);
    mockFetchCities.mockResolvedValue(['Ikeja', 'Yaba']);
    mockFetchShippingQuotes.mockResolvedValue(undefined);
  });

  it('falls back to door when pickup station remains selected after the city is cleared', async () => {
    const { rerender, result } = renderHook(
      (props: ShippingParams) => useCheckoutShipping(props),
      { initialProps: createParams() }
    );
    await waitFor(() =>
      expect(result.current.shippingStates).toEqual(['Lagos'])
    );
    await waitFor(() =>
      expect(result.current.shippingCities).toEqual(['Ikeja', 'Yaba'])
    );

    act(() => {
      result.current.handleSelectDeliveryMethod('pickup_station');
    });
    expect(result.current.deliveryMethod).toBe('pickup_station');

    rerender(createParams({ watchedCity: '' }));

    expect(result.current.deliveryMethod).toBe('door');
  });
});
