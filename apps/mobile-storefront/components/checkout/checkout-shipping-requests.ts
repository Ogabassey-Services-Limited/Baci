import { areLocationStateLabelsEquivalent } from '@baci/shared/lib';
import type { ShippingLocation } from '@/components/checkout/checkout-shipping.helpers';

const CHECKOUT_SHIPPING_STATES_CACHE_MS = 5 * 60 * 1000;

type CheckoutShippingLocationsPayload = {
  locations: ShippingLocation[];
  states: string[];
};

const warmedShippingLocations = new Map<
  string,
  {
    expiresAt: number;
    payload: CheckoutShippingLocationsPayload;
  }
>();
const pendingShippingLocations = new Map<
  string,
  Promise<CheckoutShippingLocationsPayload>
>();

function getShippingLocationsUrl(apiBaseUrl: string, state?: string) {
  const baseUrl = `${apiBaseUrl}/api/shipping/locations`;
  return state ? `${baseUrl}?state=${encodeURIComponent(state)}` : baseUrl;
}

function getCachedShippingLocations(
  cacheKey: string,
  now = Date.now()
): CheckoutShippingLocationsPayload | undefined {
  const cached = warmedShippingLocations.get(cacheKey);
  if (!cached) return undefined;
  if (cached.expiresAt <= now) {
    warmedShippingLocations.delete(cacheKey);
    return undefined;
  }
  return cached.payload;
}

function getCitiesFromLocations(
  locations: ShippingLocation[],
  state: string
): string[] {
  return [
    ...new Set(
      locations
        .filter((location: ShippingLocation) => {
          const locationState = location.state?.trim();
          return locationState
            ? areLocationStateLabelsEquivalent(locationState, state)
            : true;
        })
        .map((location) => location.city)
    ),
  ].sort();
}

export async function fetchCheckoutShippingStates(
  apiBaseUrl: string
): Promise<string[]> {
  const cacheKey = getShippingLocationsUrl(apiBaseUrl);
  const cached = getCachedShippingLocations(cacheKey);
  if (cached) {
    return cached.states;
  }

  const pending = pendingShippingLocations.get(cacheKey);
  if (pending) {
    return pending.then((payload) => payload.states);
  }

  const promise = requestCheckoutShippingLocations(apiBaseUrl).then(
    (result) => {
      if (result.cacheable) {
        warmedShippingLocations.set(cacheKey, {
          expiresAt: Date.now() + CHECKOUT_SHIPPING_STATES_CACHE_MS,
          payload: result.payload,
        });
      }
      return result.payload;
    }
  );

  pendingShippingLocations.set(cacheKey, promise);
  try {
    const payload = await promise;
    return payload.states;
  } finally {
    if (pendingShippingLocations.get(cacheKey) === promise) {
      pendingShippingLocations.delete(cacheKey);
    }
  }
}

async function requestCheckoutShippingLocations(
  apiBaseUrl: string,
  state?: string,
  signal?: AbortSignal
): Promise<{
  cacheable: boolean;
  payload: CheckoutShippingLocationsPayload;
}> {
  const res = await fetch(
    getShippingLocationsUrl(apiBaseUrl, state),
    signal ? { signal } : undefined
  );
  if (!res.ok) {
    return { cacheable: false, payload: { locations: [], states: [] } };
  }
  const data = await res.json();
  const hasValidStates = Array.isArray(data.states);
  const hasValidLocations = Array.isArray(data.locations);
  return {
    cacheable: hasValidStates || hasValidLocations,
    payload: {
      locations: hasValidLocations ? data.locations : [],
      states: hasValidStates ? data.states : [],
    },
  };
}

export async function fetchCheckoutShippingCities(
  apiBaseUrl: string,
  state: string,
  signal: AbortSignal
): Promise<string[]> {
  if (signal.aborted) return [];

  const stateCacheKey = getShippingLocationsUrl(apiBaseUrl, state);
  const cachedStatePayload = getCachedShippingLocations(stateCacheKey);
  if (cachedStatePayload) {
    return getCitiesFromLocations(cachedStatePayload.locations, state);
  }

  const baseCacheKey = getShippingLocationsUrl(apiBaseUrl);
  const cachedBasePayload = getCachedShippingLocations(baseCacheKey);
  if (cachedBasePayload?.locations.length) {
    const cachedCities = getCitiesFromLocations(
      cachedBasePayload.locations,
      state
    );
    if (cachedCities.length > 0) return cachedCities;
  }

  const pending = pendingShippingLocations.get(stateCacheKey);
  if (pending) {
    const payload = await pending;
    return signal.aborted
      ? []
      : getCitiesFromLocations(payload.locations, state);
  }

  const promise = requestCheckoutShippingLocations(apiBaseUrl, state).then(
    (result) => {
      if (result.cacheable) {
        warmedShippingLocations.set(stateCacheKey, {
          expiresAt: Date.now() + CHECKOUT_SHIPPING_STATES_CACHE_MS,
          payload: result.payload,
        });
      }
      return result.payload;
    }
  );
  pendingShippingLocations.set(stateCacheKey, promise);

  try {
    const payload = await promise;
    if (signal.aborted) return [];
    return getCitiesFromLocations(payload.locations, state);
  } finally {
    if (pendingShippingLocations.get(stateCacheKey) === promise) {
      pendingShippingLocations.delete(stateCacheKey);
    }
  }
}
