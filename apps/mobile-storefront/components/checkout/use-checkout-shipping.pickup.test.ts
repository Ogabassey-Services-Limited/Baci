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

describe('useCheckoutShipping provider pickup stations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchStates.mockResolvedValue(['Rivers']);
    mockFetchCities.mockResolvedValue(['Port Harcourt']);
    mockFetchShippingQuotes.mockImplementation((args) => {
      const quotes = [
        {
          displayName: 'Topship Door Delivery',
          id: 'door-quote',
          price: 10_000,
          provider: 'Topship',
        },
        {
          displayName: 'GIG Logistics - Pickup at PORT HARCOURT',
          id: 'station-quote',
          isStationPickup: true,
          price: 9493,
          provider: 'GIGL',
          stationAddress: 'GIGL Aba Road, Port Harcourt',
          stationName: 'PORT HARCOURT',
        },
      ];
      args.setShippingQuotes(
        args.deliveryPreference === 'pickup_station' ? [quotes[1]] : quotes
      );
      args.setSelectedQuoteId(
        args.deliveryPreference === 'pickup_station'
          ? 'station-quote'
          : 'door-quote'
      );
      args.setResolvedShippingQuoteContextKey(args.quoteContextKey);
      args.setIsLoadingQuotes(false);
      return Promise.resolve();
    });
  });

  it('selects and preserves the GIGL station quote when pickup stations are chosen outside Lagos', async () => {
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

    await waitFor(() => {
      expect(result.current.deliveryMethod).toBe('pickup_station');
      expect(result.current.selectedQuoteId).toBe('station-quote');
    });
    expect(result.current.selectedQuote?.provider).toBe('GIGL');
    expect(result.current.deliveryFee).toBe(9493);
    expect(result.current.shippingQuotes).toEqual([
      expect.objectContaining({ id: 'station-quote' }),
    ]);
    expect(mockFetchShippingQuotes).toHaveBeenLastCalledWith(
      expect.objectContaining({ previousSelectedQuoteId: null })
    );
  });

  it('requests station-pickup quotes after choosing pickup stations outside Lagos before a station quote exists', async () => {
    mockFetchShippingQuotes.mockImplementation((args) => {
      if (args.deliveryPreference === 'pickup_station') {
        args.setShippingQuotes([
          {
            displayName: 'GIG Logistics - Pickup at PORT HARCOURT',
            id: 'station-quote',
            isStationPickup: true,
            price: 9493,
            provider: 'GIGL',
            stationAddress: 'GIGL Aba Road, Port Harcourt',
            stationName: 'PORT HARCOURT',
          },
        ]);
        args.setSelectedQuoteId('station-quote');
      } else {
        args.setShippingQuotes([
          {
            displayName: 'GIG Logistics - Home Delivery',
            id: 'door-quote',
            price: 10_000,
            provider: 'GIGL',
          },
        ]);
        args.setSelectedQuoteId('door-quote');
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
      expect(mockFetchShippingQuotes).toHaveBeenLastCalledWith(
        expect.objectContaining({ deliveryPreference: 'pickup_station' })
      )
    );
    expect(result.current.deliveryMethod).toBe('pickup_station');
    expect(result.current.selectedQuoteId).toBe('station-quote');
    expect(result.current.selectedQuote?.isStationPickup).toBe(true);
  });

  it('keeps quote preferences isolated across location and method changes', async () => {
    const { result, rerender } = renderHook(
      (props: ShippingParams) => useCheckoutShipping(props),
      { initialProps: createParams() }
    );
    await waitFor(() =>
      expect(result.current.selectedQuoteId).toBe('door-quote')
    );

    act(() => result.current.handleSelectDeliveryMethod('pickup_station'));
    await waitFor(() =>
      expect(result.current.selectedQuoteId).toBe('station-quote')
    );

    rerender(createParams({ watchedCity: 'Obio-Akpor' }));
    await waitFor(() =>
      expect(mockFetchShippingQuotes).toHaveBeenCalledTimes(3)
    );
    expect(mockFetchShippingQuotes).toHaveBeenLastCalledWith(
      expect.objectContaining({
        city: 'Obio-Akpor',
        deliveryPreference: 'pickup_station',
      })
    );

    act(() => result.current.handleSelectDeliveryMethod('door'));
    await waitFor(() =>
      expect(result.current.selectedQuoteId).toBe('door-quote')
    );
    expect(mockFetchShippingQuotes).toHaveBeenLastCalledWith(
      expect.objectContaining({ deliveryPreference: 'door' })
    );
  });

  it('keeps the merchant office selected while loading paid Lagos GIG stations', async () => {
    // Lagos shows FREE merchant pickup; even when the quotes response includes a
    // provider station quote, tapping pickup must not silently switch to the
    // paid provider fee/fulfillment the card never offered.
    mockFetchStates.mockResolvedValue(['Lagos']);
    mockFetchCities.mockResolvedValue(['Ikeja']);
    mockFetchShippingQuotes.mockImplementation((args) => {
      args.setShippingQuotes([
        {
          displayName: 'Topship Door Delivery',
          id: 'door-quote',
          price: 10_000,
          provider: 'Topship',
        },
        {
          displayName: 'GIG Logistics - Pickup at IKEJA',
          id: 'station-quote',
          isStationPickup: true,
          price: 9493,
          provider: 'GIGL',
          stationAddress: 'GIGL Allen Avenue, Ikeja',
          stationName: 'IKEJA',
        },
      ]);
      args.setSelectedQuoteId('door-quote');
      args.setResolvedShippingQuoteContextKey(args.quoteContextKey);
      args.setIsLoadingQuotes(false);
      return Promise.resolve();
    });

    const { result } = renderHook(
      (props: ShippingParams) => useCheckoutShipping(props),
      {
        initialProps: createParams({
          watchedState: 'Lagos',
          watchedCity: 'Ikeja',
        }),
      }
    );

    await waitFor(() =>
      expect(result.current.selectedQuoteId).toBe('door-quote')
    );

    act(() => {
      result.current.handleSelectDeliveryMethod('pickup_station');
    });

    expect(result.current.deliveryMethod).toBe('pickup_station');
    await waitFor(() =>
      expect(mockFetchShippingQuotes).toHaveBeenLastCalledWith(
        expect.objectContaining({ deliveryPreference: 'pickup_station' })
      )
    );
    expect(result.current.selectedQuoteId).toBe('merchant-office-pickup');
    expect(result.current.selectedQuote).toBeUndefined();
    expect(result.current.deliveryFee).toBe(0);
    expect(result.current.requiresShippingQuote).toBe(false);
    expect(result.current.shippingQuotes).toEqual([
      expect.objectContaining({ id: 'door-quote' }),
      expect.objectContaining({ id: 'station-quote' }),
    ]);

    act(() => {
      result.current.setSelectedQuoteId('station-quote');
    });

    expect(result.current.selectedQuote?.provider).toBe('GIGL');
    expect(result.current.deliveryFee).toBe(9493);
    expect(result.current.requiresShippingQuote).toBe(true);
  });

  it('returns to the door quote when switching back to door delivery', async () => {
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
      expect(result.current.selectedQuoteId).toBe('station-quote')
    );

    act(() => {
      result.current.handleSelectDeliveryMethod('door');
    });

    await waitFor(() => {
      expect(result.current.deliveryMethod).toBe('door');
      expect(result.current.selectedQuoteId).toBe('door-quote');
    });
    expect(result.current.selectedQuote?.provider).toBe('Topship');
    expect(result.current.deliveryFee).toBe(10_000);
  });
});
