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

const setValue = jest.fn() as jest.MockedFunction<
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
    setValue,
    watchedAddress: '5 Customer Street',
    watchedCity: 'Port Harcourt',
    watchedEmail: 'ada@example.com',
    watchedFirstName: 'Ada',
    watchedLastName: 'Lovelace',
    watchedPhone: '08012345678',
    watchedState: 'Rivers',
    ...overrides,
  };
}

function resolveDoorQuote(args: FetchQuotesArgs) {
  args.setShippingQuotes([
    {
      displayName: 'Topship Door Delivery',
      id: 'door-quote',
      price: 10_000,
      provider: 'Topship',
    },
  ]);
  args.setSelectedQuoteId('door-quote');
  args.setResolvedShippingQuoteContextKey(args.quoteContextKey);
  args.setIsLoadingQuotes(false);
}

describe('useCheckoutShipping provider pickup station failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchStates.mockResolvedValue(['Rivers']);
    mockFetchCities.mockResolvedValue(['Port Harcourt']);
  });

  it('keeps pickup stations selected with no quote when GIGL has no station rate yet', async () => {
    mockFetchShippingQuotes.mockImplementation((args) => {
      if (args.deliveryPreference === 'pickup_station') {
        args.setShippingQuotes([]);
        args.setSelectedQuoteId('');
      } else {
        resolveDoorQuote(args);
      }
      args.setResolvedShippingQuoteContextKey(args.quoteContextKey);
      args.setIsLoadingQuotes(false);
      return Promise.resolve();
    });

    const { result } = renderHook(
      (props: ShippingParams) => useCheckoutShipping(props),
      { initialProps: createParams() }
    );

    await waitFor(() =>
      expect(result.current.selectedQuoteId).toBe('door-quote')
    );

    act(() => {
      result.current.handleSelectDeliveryMethod('pickup_station');
    });

    await waitFor(() =>
      expect(result.current.deliveryMethod).toBe('pickup_station')
    );
    expect(result.current.selectedQuoteId).toBe('');
    expect(result.current.selectedQuote).toBeUndefined();
    expect(result.current.deliveryFee).toBe(0);
  });

  it('keeps pickup station selected when quote loading rejects', async () => {
    mockFetchShippingQuotes.mockImplementation((args) => {
      if (args.deliveryPreference === 'pickup_station') {
        return Promise.reject(new Error('quote failed'));
      }
      resolveDoorQuote(args);
      return Promise.resolve();
    });

    const { result } = renderHook(
      (props: ShippingParams) => useCheckoutShipping(props),
      { initialProps: createParams() }
    );

    await waitFor(() =>
      expect(result.current.selectedQuoteId).toBe('door-quote')
    );

    act(() => {
      result.current.handleSelectDeliveryMethod('pickup_station');
    });

    await waitFor(() =>
      expect(result.current.deliveryMethod).toBe('pickup_station')
    );
    expect(result.current.selectedQuoteId).toBe('');
    expect(result.current.selectedQuote).toBeUndefined();
    expect(result.current.deliveryFee).toBe(0);
  });
});
