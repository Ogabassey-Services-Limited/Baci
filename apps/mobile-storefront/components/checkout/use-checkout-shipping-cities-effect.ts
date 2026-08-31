import { useEffect, useEffectEvent } from 'react';
import { loadShippingCities } from './checkout-shipping-loaders';

export function useCheckoutShippingCitiesEffect(params: {
  apiBaseUrl: string;
  onCitiesLoaded: (cities: string[]) => void;
  setIsLoadingCities: (value: boolean) => void;
  setShippingCities: (cities: string[]) => void;
  state: string;
}) {
  const {
    apiBaseUrl,
    onCitiesLoaded,
    setIsLoadingCities,
    setShippingCities,
    state,
  } = params;
  const handleCitiesLoaded = useEffectEvent(onCitiesLoaded);
  const handleLoading = useEffectEvent(setIsLoadingCities);
  const handleCities = useEffectEvent(setShippingCities);
  useEffect(() => {
    if (!state) return;
    const controller = new AbortController();
    loadShippingCities({
      apiBaseUrl,
      onCitiesLoaded: handleCitiesLoaded,
      setIsLoadingCities: handleLoading,
      setShippingCities: handleCities,
      signal: controller.signal,
      state,
    });
    return () => controller.abort();
  }, [apiBaseUrl, state]);
}
