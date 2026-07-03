import { isPickupEligible } from '@baci/shared';
import type { RefObject } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import { normalizeStateName } from '@/components/checkout/checkout-shipping.helpers';
import type {
  DeliveryMethod,
  ShippingQuote,
} from '@/components/checkout/types';
import type { PlaceDetails } from '@/components/ui/AddressAutocomplete';
import type { ShippingAddressInput } from '@/lib/validation';

interface CreateCheckoutShippingHandlersParams {
  committedAddress: string;
  currentShippingQuoteContextKey: string;
  deliveryMethod: DeliveryMethod;
  requestShippingQuotes: (shouldResetSelection: boolean) => void;
  resolvedShippingQuoteContextKey: string;
  savedDoorAddressRef: RefObject<{
    address: string;
    city: string;
    state: string;
  } | null>;
  setCitySearch: (value: string) => void;
  setCommittedAddress: (value: string) => void;
  setDeliveryMethod: (value: DeliveryMethod) => void;
  setResolvedShippingQuoteContextKey: (value: string) => void;
  setSelectedQuoteId: (value: string) => void;
  setShowCityPicker: (value: boolean) => void;
  setShowStatePicker: (value: boolean) => void;
  setValue: UseFormSetValue<ShippingAddressInput>;
  shippingQuoteAbortRef: RefObject<AbortController | null>;
  shippingStates: string[];
  watchedAddress: string;
  watchedCity: string;
  watchedState: string;
  googleSuggestedCityRef: RefObject<string | null>;
  stationPickupQuote?: ShippingQuote;
}

export function createCheckoutShippingHandlers({
  committedAddress,
  currentShippingQuoteContextKey,
  deliveryMethod,
  googleSuggestedCityRef,
  requestShippingQuotes,
  resolvedShippingQuoteContextKey,
  savedDoorAddressRef,
  setCitySearch,
  setCommittedAddress,
  setDeliveryMethod,
  setResolvedShippingQuoteContextKey,
  setSelectedQuoteId,
  setShowCityPicker,
  setShowStatePicker,
  setValue,
  shippingQuoteAbortRef,
  shippingStates,
  watchedAddress,
  watchedCity,
  watchedState,
  stationPickupQuote,
}: CreateCheckoutShippingHandlersParams) {
  return {
    handleDeliveryAddressSelect: (
      place: PlaceDetails,
      updateAddress: (value: string) => void
    ) => {
      const selectedAddress = place.formattedAddress || '';
      updateAddress(selectedAddress);
      setCommittedAddress(selectedAddress);
      const normalizedState = place.state
        ? normalizeStateName(place.state, shippingStates)
        : '';

      if (place.city) {
        const normalizedCity = place.city.trim().toLowerCase();
        googleSuggestedCityRef.current =
          normalizedState && normalizedCity === normalizedState.toLowerCase()
            ? ''
            : place.city;
      }

      setValue('city', '', { shouldValidate: false });
      if (normalizedState) {
        setValue('state', normalizedState, { shouldValidate: true });
      }
    },
    handleDeliveryAddressTextChange: (
      text: string,
      updateAddress: (value: string) => void
    ) => {
      updateAddress(text);
      if (committedAddress) setResolvedShippingQuoteContextKey('');
      setCommittedAddress('');
    },
    handleRetryShippingQuotes: () => {
      if (!watchedState || !watchedCity) return;
      if (shippingQuoteAbortRef.current) shippingQuoteAbortRef.current.abort();
      requestShippingQuotes(
        resolvedShippingQuoteContextKey !== currentShippingQuoteContextKey
      );
    },
    handleSelectCity: (city: string) => {
      setValue('city', city, { shouldValidate: true });
      setShowCityPicker(false);
      setCitySearch('');
    },
    handleSelectDeliveryMethod: (method: DeliveryMethod) => {
      if (method === 'pickup_station' && deliveryMethod !== 'pickup_station') {
        savedDoorAddressRef.current = {
          address: watchedAddress,
          city: watchedCity,
          state: watchedState,
        };
      } else if (
        method !== 'pickup_station' &&
        deliveryMethod === 'pickup_station'
      ) {
        const saved = savedDoorAddressRef.current;
        if (saved) {
          setValue('address', saved.address, { shouldValidate: false });
          setValue('city', saved.city, { shouldValidate: false });
          setValue('state', saved.state, { shouldValidate: false });
          setCommittedAddress(saved.address);
          savedDoorAddressRef.current = null;
        }
        setSelectedQuoteId('');
      }
      if (method === 'pickup_station') {
        // Only select the provider station quote when the card actually offered
        // provider-backed pickup (non-Lagos). In Lagos the card shows FREE
        // merchant pickup, so selecting the paid station quote would silently
        // switch the fee + fulfillment to a station the customer never chose.
        setSelectedQuoteId(
          stationPickupQuote && !isPickupEligible(watchedState)
            ? String(stationPickupQuote.id)
            : ''
        );
      }
      setDeliveryMethod(method);
    },
    handleSelectState: (state: string) => {
      setValue('state', state, { shouldValidate: true });
      setValue('city', '', { shouldValidate: true });
      setShowStatePicker(false);
    },
  };
}
