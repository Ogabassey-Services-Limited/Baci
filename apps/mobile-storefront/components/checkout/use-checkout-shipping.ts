import { isAirportDeliveryEligible } from '@baci/shared';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import {
  fetchShippingQuotes,
  resolveGoogleCitySuggestionAction,
} from '@/components/checkout/checkout-shipping.helpers';
import {
  getPickupStationMode,
  getStationPickupQuote,
} from '@/components/checkout/checkout-station-pickup';
import {
  getDeliveryMethodFee,
  getShippingProviderForMethod,
} from '@/components/checkout/checkout-step-helpers';
import type {
  DeliveryMethod,
  ShippingQuote,
} from '@/components/checkout/types';
import { buildShippingQuoteContextKey } from '@/lib/shipping-quotes';
import type { ShippingAddressInput } from '@/lib/validation';
import type { useCartStore } from '@/stores/cart-store';
import { createCheckoutShippingHandlers } from './checkout-shipping-handlers';
import {
  loadShippingCities,
  loadShippingStates,
} from './checkout-shipping-loaders';
type CartItems = ReturnType<typeof useCartStore.getState>['items'];
type QuoteCustomer = Parameters<typeof fetchShippingQuotes>[0]['customer'];
interface UseCheckoutShippingParams {
  apiBaseUrl: string;
  customer: QuoteCustomer;
  items: CartItems;
  setValue: UseFormSetValue<ShippingAddressInput>;
  watchedAddress: string;
  watchedCity: string;
  watchedEmail: string;
  watchedFirstName: string;
  watchedLastName: string;
  watchedPhone: string;
  watchedState: string;
}
export function useCheckoutShipping({
  apiBaseUrl,
  customer,
  items,
  setValue,
  watchedAddress,
  watchedCity,
  watchedEmail,
  watchedFirstName,
  watchedLastName,
  watchedPhone,
  watchedState,
}: UseCheckoutShippingParams) {
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('door');
  const [shippingStates, setShippingStates] = useState<string[]>([]);
  const [shippingCities, setShippingCities] = useState<string[]>([]);
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [resolvedShippingQuoteContextKey, setResolvedShippingQuoteContextKey] =
    useState('');
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(() =>
    Boolean(watchedState)
  );
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [citySearchFocused, setCitySearchFocused] = useState(false);
  const [committedAddress, setCommittedAddress] = useState('');
  const savedDoorAddressRef = useRef<{
    address: string;
    city: string;
    state: string;
  } | null>(null);
  const googleSuggestedCityRef = useRef<string | null>(null);
  const shippingQuoteAbortRef = useRef<AbortController | null>(null);
  const currentShippingQuoteContextKey = buildShippingQuoteContextKey(
    watchedState,
    watchedCity,
    items,
    committedAddress
  );
  const isCurrentQuoteContext =
    currentShippingQuoteContextKey !== '' &&
    resolvedShippingQuoteContextKey === currentShippingQuoteContextKey;
  const stationPickupQuote = isCurrentQuoteContext
    ? getStationPickupQuote(shippingQuotes)
    : undefined;
  const {
    canUsePickupStation,
    hasResolvedDeliveryLocation,
    usesProviderPickup,
  } = getPickupStationMode({
    city: watchedCity,
    deliveryMethod,
    state: watchedState,
    stationPickupQuote,
  });
  if (
    (deliveryMethod !== 'door' && !hasResolvedDeliveryLocation) ||
    (deliveryMethod === 'airport' &&
      !isAirportDeliveryEligible(watchedState)) ||
    (deliveryMethod === 'pickup_station' && !canUsePickupStation)
  ) {
    setDeliveryMethod('door');
  }

  const resetQuotes = () => {
    setShippingQuotes([]);
    setSelectedQuoteId('');
    setResolvedShippingQuoteContextKey('');
  };
  const requestShippingQuotes = (shouldResetSelection: boolean) => {
    const controller = new AbortController();
    shippingQuoteAbortRef.current = controller;
    void fetchShippingQuotes({
      apiUrl: apiBaseUrl,
      state: watchedState,
      city: watchedCity,
      items,
      customer,
      watchedFirstName,
      watchedLastName,
      watchedPhone,
      watchedAddress,
      watchedEmail,
      deliveryPreference:
        deliveryMethod === 'pickup_station' ? 'pickup_station' : 'door',
      setIsLoadingQuotes,
      setSelectedQuoteId,
      setResolvedShippingQuoteContextKey,
      setShippingQuotes,
      previousSelectedQuoteId: shouldResetSelection ? null : selectedQuoteId,
      quoteContextKey: currentShippingQuoteContextKey,
      shouldResetSelection,
      signal: controller.signal,
    }).catch(() => setIsLoadingQuotes(false));
  };
  const requestShippingQuotesFromEffect = useEffectEvent(
    (shouldResetSelection: boolean) => {
      requestShippingQuotes(shouldResetSelection);
    }
  );
  const applyGoogleSuggestedCity = useEffectEvent((cities: string[]) => {
    const action = resolveGoogleCitySuggestionAction(
      cities,
      googleSuggestedCityRef.current
    );
    if (action.type === 'none') return;
    googleSuggestedCityRef.current = null;

    if (action.type === 'openPicker') {
      setShowCityPicker(true);
      return;
    }

    if (action.type === 'selectCity') {
      setValue('city', action.city, { shouldValidate: true });
    } else {
      setCitySearch(action.city);
      setShowCityPicker(true);
    }
  });
  const [prevCityRequest, setPrevCityRequest] = useState(() => ({
    apiBaseUrl,
    watchedState,
  }));
  if (
    prevCityRequest.apiBaseUrl !== apiBaseUrl ||
    prevCityRequest.watchedState !== watchedState
  ) {
    setPrevCityRequest({ apiBaseUrl, watchedState });
    setShippingCities([]);
    setIsLoadingCities(Boolean(watchedState));
    if (!watchedState) resetQuotes();
  }
  const quotesSuspendReason =
    deliveryMethod === 'airport' ||
    (deliveryMethod === 'pickup_station' && !usesProviderPickup)
      ? 'method'
      : watchedState && watchedCity
        ? null
        : 'address';
  const [prevQuotesSuspendReason, setPrevQuotesSuspendReason] =
    useState(quotesSuspendReason);
  if (prevQuotesSuspendReason !== quotesSuspendReason) {
    setPrevQuotesSuspendReason(quotesSuspendReason);
    if (quotesSuspendReason === 'method') setIsLoadingQuotes(false);
    if (quotesSuspendReason !== null) resetQuotes();
  }
  useEffect(() => {
    loadShippingStates({
      apiBaseUrl,
      setIsLoadingLocations,
      setShippingStates,
    });
  }, [apiBaseUrl]);
  useEffect(() => {
    if (!watchedState) return;
    const controller = new AbortController();
    loadShippingCities({
      apiBaseUrl,
      onCitiesLoaded: (cities) => applyGoogleSuggestedCity(cities),
      setIsLoadingCities,
      setShippingCities,
      signal: controller.signal,
      state: watchedState,
    });
    return () => controller.abort();
  }, [apiBaseUrl, watchedState]);
  // biome-ignore lint/correctness/useExhaustiveDependencies(items): cart item identity changes must re-request quotes (pre-refactor behavior).
  useEffect(() => {
    if (shippingQuoteAbortRef.current) shippingQuoteAbortRef.current.abort();
    if (
      (deliveryMethod !== 'door' && !usesProviderPickup) ||
      !watchedState ||
      !watchedCity
    ) {
      shippingQuoteAbortRef.current = null;
      return;
    }

    requestShippingQuotesFromEffect(
      resolvedShippingQuoteContextKey !== currentShippingQuoteContextKey
    );

    return () => {
      if (shippingQuoteAbortRef.current) shippingQuoteAbortRef.current.abort();
    };
  }, [
    currentShippingQuoteContextKey,
    deliveryMethod,
    items,
    resolvedShippingQuoteContextKey,
    usesProviderPickup,
    watchedCity,
    watchedState,
  ]);
  const selectedQuote = shippingQuotes.find(
    (quote) => String(quote.id) === String(selectedQuoteId)
  );
  const deliveryFee = getDeliveryMethodFee(deliveryMethod, selectedQuote);
  const requiresShippingQuote =
    Boolean(currentShippingQuoteContextKey) &&
    (deliveryMethod === 'door' || usesProviderPickup);
  const handlers = createCheckoutShippingHandlers({
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
    stationPickupQuote,
    watchedAddress,
    watchedCity,
    watchedState,
  });
  return {
    citySearch,
    citySearchFocused,
    currentShippingQuoteContextKey,
    deliveryFee,
    deliveryMethod,
    getShippingProvider: () =>
      getShippingProviderForMethod(deliveryMethod, selectedQuote),
    ...handlers,
    isLoadingCities,
    isLoadingLocations,
    isLoadingQuotes,
    resolvedShippingQuoteContextKey,
    requiresShippingQuote,
    selectedQuote,
    selectedQuoteId,
    setCitySearch,
    setCitySearchFocused,
    setCommittedAddress,
    setSelectedQuoteId,
    setShowCityPicker,
    setShowStatePicker,
    shippingCities,
    shippingQuotes,
    shippingStates,
    showCityPicker,
    showStatePicker,
  };
}
