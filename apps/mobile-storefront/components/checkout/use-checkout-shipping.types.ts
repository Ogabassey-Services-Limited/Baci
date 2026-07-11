import type { UseFormSetValue } from 'react-hook-form';
import type { fetchShippingQuotes } from '@/components/checkout/checkout-shipping.helpers';
import type { ShippingAddressInput } from '@/lib/validation';
import type { useCartStore } from '@/stores/cart-store';

type QuoteCustomer = Parameters<typeof fetchShippingQuotes>[0]['customer'];

export interface SavedDoorAddress {
  address: string;
  city: string;
  coordinates: { latitude: number; longitude: number } | null;
  state: string;
}

export interface UseCheckoutShippingParams {
  apiBaseUrl: string;
  customer: QuoteCustomer;
  items: ReturnType<typeof useCartStore.getState>['items'];
  setValue: UseFormSetValue<ShippingAddressInput>;
  watchedAddress: string;
  watchedCity: string;
  watchedEmail: string;
  watchedFirstName: string;
  watchedLastName: string;
  watchedPhone: string;
  watchedState: string;
}
