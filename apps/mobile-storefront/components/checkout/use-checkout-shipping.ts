import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import { fetchShippingQuotes } from '@/components/checkout/checkout-shipping.helpers';
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
  fetchCheckoutShippingCities,
  fetchCheckoutShippingStates,
} from './checkout-shipping-requests';

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

// Module-scope helpers own the try/finally finalizers: React Compiler cannot
// yet lower try/finally inside a hook body, which disabled memoization for the
// whole hook.
async function loadShippingStates(params: {
  apiBaseUrl: string;
  setIsLoadingLocations: (value: boolean) => void;
  setShippingStates: (states: string[]) => void;
}) {
  const { apiBaseUrl, setIsLoadingLocations, setShippingStates } = params;
  setIsLoadingLocations(true);
  try {
    setShippingStates(await fetchCheckoutShippingStates(apiBaseUrl));
  } catch {
    // Shipping locations are optional until the customer enters an address.
  } finally {
    setIsLoadingLocations(false);
  }
}

async function loadShippingCities(params: {
  apiBaseUrl: string;
  onCitiesLoaded: (cities: string[]) => void;
  setIsLoadingCities: (value: boolean) => void;
  setShippingCities: (cities: string[]) => void;
  signal: AbortSignal;
  state: string;
}) {
  const {
    apiBaseUrl,
    onCitiesLoaded,
    setIsLoadingCities,
    setShippingCities,
    signal,
    state,
  } = params;
  try {
    const cities = await fetchCheckoutShippingCities(apiBaseUrl, state, signal);
    setShippingCities(cities);
    if (!signal.aborted) onCitiesLoaded(cities);
  } catch {
    if (!signal.aborted) setShippingCities([]);
  } finally {
    if (!signal.aborted) setIsLoadingCities(false);
  }
}

// Hook wrapper so the stable ref containers can flow into the handler factory
// without React Compiler treating the render-time call as a ref read.
function useCheckoutShippingHandlers(
  params: Parameters<typeof createCheckoutShippingHandlers>[0]
) {
  return createCheckoutShippingHandlers(params);
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

  const resetQuotes = () => {
    setShippingQuotes([]);
    setSelectedQuoteId('');
    setResolvedShippingQuoteContextKey('');
  };

  const requestShippingQuotes = (shouldResetSelection: boolean) => {
    const controller = new AbortController();
    shippingQuoteAbortRef.current = controller;
    fetchShippingQuotes({
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
      setIsLoadingQuotes,
      setSelectedQuoteId,
      setResolvedShippingQuoteContextKey,
      setShippingQuotes,
      previousSelectedQuoteId: shouldResetSelection ? null : selectedQuoteId,
      quoteContextKey: currentShippingQuoteContextKey,
      shouldResetSelection,
      signal: controller.signal,
    });
  };

  const requestShippingQuotesFromEffect = useEffectEvent(
    (shouldResetSelection: boolean) => {
      requestShippingQuotes(shouldResetSelection);
    }
  );

  // Consumes the pending Google Places city suggestion once cities for the
  // selected state finish loading (runs from the fetch completion, with the
  // freshly loaded list, instead of an effect that mirrored it from state).
  const applyGoogleSuggestedCity = useEffectEvent((cities: string[]) => {
    if (cities.length === 0) return;
    const suggestedCity = googleSuggestedCityRef.current;
    if (suggestedCity === null) return;
    googleSuggestedCityRef.current = null;

    if (suggestedCity === '') {
      setShowCityPicker(true);
      return;
    }

    const match = cities.find(
      (city) => city.toLowerCase() === suggestedCity.toLowerCase()
    );
    if (match) {
      setValue('city', match, { shouldValidate: true });
    } else {
      setCitySearch(suggestedCity);
      setShowCityPicker(true);
    }
  });

  // Adjust dependent state inline during render (guarded prev-compare) so the
  // reset commits with the change that caused it instead of one frame later.
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
    deliveryMethod !== 'door'
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
    if (deliveryMethod !== 'door' || !watchedState || !watchedCity) {
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
    watchedCity,
    watchedState,
  ]);

  const selectedQuote = shippingQuotes.find(
    (quote) => String(quote.id) === String(selectedQuoteId)
  );
  const deliveryFee = getDeliveryMethodFee(deliveryMethod, selectedQuote);

  const handlers = useCheckoutShippingHandlers({
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
    setShowCityPicker,
    setShowStatePicker,
    setValue,
    shippingQuoteAbortRef,
    shippingStates,
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
