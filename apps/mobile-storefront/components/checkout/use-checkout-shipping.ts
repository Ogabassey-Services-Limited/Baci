import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import {
  fetchShippingQuotes,
} from '@/components/checkout/checkout-shipping.helpers';
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
import {
  fetchCheckoutShippingCities,
  fetchCheckoutShippingStates,
} from './checkout-shipping-requests';
import { createCheckoutShippingHandlers } from './checkout-shipping-handlers';

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
  const [isLoadingCities, setIsLoadingCities] = useState(false);
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
  const selectedQuoteIdRef = useRef(selectedQuoteId);
  selectedQuoteIdRef.current = selectedQuoteId;
  const shippingQuoteReceiverRef = useRef({
    customer,
    watchedAddress,
    watchedEmail,
    watchedFirstName,
    watchedLastName,
    watchedPhone,
  });
  shippingQuoteReceiverRef.current = {
    customer,
    watchedAddress,
    watchedEmail,
    watchedFirstName,
    watchedLastName,
    watchedPhone,
  };
  const currentShippingQuoteContextKey = buildShippingQuoteContextKey(
    watchedState,
    watchedCity,
    items,
    committedAddress
  );
  const requestShippingQuotesFromEffect = useEffectEvent(
    (shouldResetSelection: boolean) => {
      requestShippingQuotes(shouldResetSelection);
    }
  );

  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoadingLocations(true);
      try {
        setShippingStates(await fetchCheckoutShippingStates(apiBaseUrl));
      } catch {
        // Shipping locations are optional until the customer enters an address.
      } finally {
        setIsLoadingLocations(false);
      }
    };
    fetchLocations();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!watchedState) {
      setShippingCities([]);
      setIsLoadingCities(false);
      resetQuotes();
      return;
    }

    const controller = new AbortController();
    setShippingCities([]);
    setIsLoadingCities(true);
    const fetchCities = async () => {
      try {
        setShippingCities(
          await fetchCheckoutShippingCities(
            apiBaseUrl,
            watchedState,
            controller.signal
          )
        );
      } catch {
        if (!controller.signal.aborted) setShippingCities([]);
      } finally {
        if (!controller.signal.aborted) setIsLoadingCities(false);
      }
    };
    fetchCities();
    return () => controller.abort();
  }, [apiBaseUrl, watchedState]);

  useEffect(() => {
    if (isLoadingCities || shippingCities.length === 0) return;
    const suggestedCity = googleSuggestedCityRef.current;
    if (suggestedCity === null) return;
    googleSuggestedCityRef.current = null;

    if (suggestedCity === '') {
      setShowCityPicker(true);
      return;
    }

    const match = shippingCities.find(
      (city) => city.toLowerCase() === suggestedCity.toLowerCase()
    );
    if (match) {
      setValue('city', match, { shouldValidate: true });
    } else {
      setCitySearch(suggestedCity);
      setShowCityPicker(true);
    }
  }, [isLoadingCities, setValue, shippingCities]);

  useEffect(() => {
    if (shippingQuoteAbortRef.current) shippingQuoteAbortRef.current.abort();
    if (deliveryMethod !== 'door') {
      shippingQuoteAbortRef.current = null;
      setIsLoadingQuotes(false);
      resetQuotes();
      return;
    }

    if (watchedState && watchedCity) {
      requestShippingQuotesFromEffect(
        resolvedShippingQuoteContextKey !== currentShippingQuoteContextKey
      );
    } else {
      shippingQuoteAbortRef.current = null;
      resetQuotes();
    }

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

  const requestShippingQuotes = (shouldResetSelection: boolean) => {
    const controller = new AbortController();
    shippingQuoteAbortRef.current = controller;
    const receiver = shippingQuoteReceiverRef.current;
    fetchShippingQuotes({
      apiUrl: apiBaseUrl,
      state: watchedState,
      city: watchedCity,
      items,
      customer: receiver.customer,
      watchedFirstName: receiver.watchedFirstName,
      watchedLastName: receiver.watchedLastName,
      watchedPhone: receiver.watchedPhone,
      watchedAddress: receiver.watchedAddress,
      watchedEmail: receiver.watchedEmail,
      setIsLoadingQuotes,
      setSelectedQuoteId,
      setResolvedShippingQuoteContextKey,
      setShippingQuotes,
      previousSelectedQuoteId: shouldResetSelection
        ? null
        : selectedQuoteIdRef.current,
      quoteContextKey: currentShippingQuoteContextKey,
      shouldResetSelection,
      signal: controller.signal,
    });
  };

  const resetQuotes = () => {
    setShippingQuotes([]);
    setSelectedQuoteId('');
    setResolvedShippingQuoteContextKey('');
  };

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
