import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { UseFormSetValue } from 'react-hook-form';
import type { FetchQuotesArgs } from '@/components/checkout/checkout-shipping.helpers';
import type { ShippingQuote } from '@/components/checkout/types';
import type { PlaceDetails } from '@/components/ui/AddressAutocomplete';
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

const mockSetValue = jest.fn();
const setValue =
  mockSetValue as unknown as UseFormSetValue<ShippingAddressInput>;

const cartItem: CartItem = {
  id: 'line-1',
  name: 'iPhone 13',
  price: 500_000,
  product_id: 'product-1',
  quantity: 1,
  slug: 'iphone-13',
};
const items = [cartItem];

type ShippingParams = Parameters<typeof useCheckoutShipping>[0];

function createParams(overrides: Partial<ShippingParams> = {}): ShippingParams {
  return {
    apiBaseUrl: 'https://api.example.com',
    customer: null,
    items,
    setValue,
    watchedAddress: '',
    watchedCity: '',
    watchedEmail: '',
    watchedFirstName: '',
    watchedLastName: '',
    watchedPhone: '',
    watchedState: '',
    ...overrides,
  };
}

function createPlace(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    city: 'ikeja',
    country: 'Nigeria',
    formattedAddress: '1 Test Way, Ikeja',
    route: 'Test Way',
    state: 'Lagos',
    streetNumber: '1',
    zip: '',
    ...overrides,
  };
}

describe('useCheckoutShipping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchStates.mockResolvedValue(['Lagos']);
    mockFetchCities.mockResolvedValue(['Ikeja', 'Yaba']);
    mockFetchShippingQuotes.mockResolvedValue(undefined);
  });

  it('loads shipping states on mount and clears the loading flag', async () => {
    const { result } = renderHook(
      (props: ShippingParams) => useCheckoutShipping(props),
      { initialProps: createParams() }
    );

    await waitFor(() =>
      expect(result.current.shippingStates).toEqual(['Lagos'])
    );

    expect(mockFetchStates).toHaveBeenCalledWith('https://api.example.com');
    expect(result.current.isLoadingLocations).toBe(false);
  });

  it('fetches cities when a state is selected and clears them when it is removed', async () => {
    const { rerender, result } = renderHook(
      (props: ShippingParams) => useCheckoutShipping(props),
      { initialProps: createParams() }
    );

    rerender(createParams({ watchedState: 'Lagos' }));

    expect(result.current.isLoadingCities).toBe(true);
    await waitFor(() =>
      expect(result.current.shippingCities).toEqual(['Ikeja', 'Yaba'])
    );
    expect(result.current.isLoadingCities).toBe(false);

    rerender(createParams());

    expect(result.current.shippingCities).toEqual([]);
    expect(result.current.isLoadingCities).toBe(false);
    expect(result.current.selectedQuoteId).toBe('');
  });

  it('applies a Google-suggested city once the matching city list loads', async () => {
    const updateAddress = jest.fn();
    const { rerender, result } = renderHook(
      (props: ShippingParams) => useCheckoutShipping(props),
      { initialProps: createParams() }
    );
    await waitFor(() =>
      expect(result.current.shippingStates).toEqual(['Lagos'])
    );

    act(() => {
      result.current.handleDeliveryAddressSelect(createPlace(), updateAddress);
    });
    rerender(createParams({ watchedState: 'Lagos' }));

    expect(updateAddress).toHaveBeenCalledWith('1 Test Way, Ikeja');
    await waitFor(() =>
      expect(mockSetValue).toHaveBeenCalledWith('city', 'Ikeja', {
        shouldValidate: true,
      })
    );
  });

  it('opens the city picker with a search seed when the suggested city has no match', async () => {
    const updateAddress = jest.fn();
    const { rerender, result } = renderHook(
      (props: ShippingParams) => useCheckoutShipping(props),
      { initialProps: createParams() }
    );
    await waitFor(() =>
      expect(result.current.shippingStates).toEqual(['Lagos'])
    );

    act(() => {
      result.current.handleDeliveryAddressSelect(
        createPlace({ city: 'Magodo' }),
        updateAddress
      );
    });
    rerender(createParams({ watchedState: 'Lagos' }));

    await waitFor(() => expect(result.current.showCityPicker).toBe(true));
    expect(result.current.citySearch).toBe('Magodo');
    expect(mockSetValue).not.toHaveBeenCalledWith('city', 'Magodo', {
      shouldValidate: true,
    });
  });

  it('requests quotes for door delivery once state and city are present', async () => {
    const { rerender } = renderHook(
      (props: ShippingParams) => useCheckoutShipping(props),
      { initialProps: createParams() }
    );

    rerender(createParams({ watchedCity: 'Ikeja', watchedState: 'Lagos' }));

    await waitFor(() =>
      expect(mockFetchShippingQuotes).toHaveBeenCalledTimes(1)
    );
    expect(mockFetchShippingQuotes).toHaveBeenCalledWith(
      expect.objectContaining({
        city: 'Ikeja',
        shouldResetSelection: true,
        state: 'Lagos',
      })
    );
  });

  it('resets quote state when switching to pickup-station delivery', async () => {
    const quote: ShippingQuote = {
      displayName: 'GIGL Standard',
      id: 'quote-1',
      price: 2500,
    };
    mockFetchShippingQuotes.mockImplementation((args) => {
      args.setIsLoadingQuotes(true);
      args.setShippingQuotes([quote]);
      args.setSelectedQuoteId('quote-1');
      args.setResolvedShippingQuoteContextKey(args.quoteContextKey);
      return Promise.resolve();
    });
    const { rerender, result } = renderHook(
      (props: ShippingParams) => useCheckoutShipping(props),
      { initialProps: createParams() }
    );

    rerender(createParams({ watchedCity: 'Ikeja', watchedState: 'Lagos' }));
    await waitFor(() => expect(result.current.selectedQuoteId).toBe('quote-1'));

    act(() => {
      result.current.handleSelectDeliveryMethod('pickup_station');
    });

    expect(result.current.deliveryMethod).toBe('pickup_station');
    expect(result.current.shippingQuotes).toEqual([]);
    expect(result.current.selectedQuoteId).toBe('');
    expect(result.current.isLoadingQuotes).toBe(false);
  });
});
