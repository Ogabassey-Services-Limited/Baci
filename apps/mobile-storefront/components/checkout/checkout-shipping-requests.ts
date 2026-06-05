import { areLocationStateLabelsEquivalent } from '@baci/shared/lib';
import type { ShippingLocation } from '@/components/checkout/checkout-shipping.helpers';

const CHECKOUT_SHIPPING_STATES_CACHE_MS = 5 * 60 * 1000;

let warmedShippingStates:
  | {
      apiBaseUrl: string;
      expiresAt: number;
      states: string[];
    }
  | undefined;
let pendingShippingStates:
  | {
      apiBaseUrl: string;
      promise: Promise<string[]>;
    }
  | undefined;

export async function fetchCheckoutShippingStates(
  apiBaseUrl: string
): Promise<string[]> {
  const now = Date.now();
  if (
    warmedShippingStates?.apiBaseUrl === apiBaseUrl &&
    warmedShippingStates.expiresAt > now
  ) {
    return warmedShippingStates.states;
  }

  if (pendingShippingStates?.apiBaseUrl === apiBaseUrl) {
    return pendingShippingStates.promise;
  }

  const promise = requestCheckoutShippingStates(apiBaseUrl).then((result) => {
    if (result.cacheable) {
      warmedShippingStates = {
        apiBaseUrl,
        expiresAt: Date.now() + CHECKOUT_SHIPPING_STATES_CACHE_MS,
        states: result.states,
      };
    }
    return result.states;
  });

  pendingShippingStates = { apiBaseUrl, promise };
  try {
    return await promise;
  } finally {
    if (pendingShippingStates?.promise === promise) {
      pendingShippingStates = undefined;
    }
  }
}

async function requestCheckoutShippingStates(
  apiBaseUrl: string
): Promise<{ cacheable: boolean; states: string[] }> {
  const res = await fetch(`${apiBaseUrl}/api/shipping/locations`);
  if (!res.ok) return { cacheable: false, states: [] };
  const data = await res.json();
  const hasValidStates = Array.isArray(data.states);
  return {
    cacheable: hasValidStates,
    states: hasValidStates ? data.states : [],
  };
}

export async function fetchCheckoutShippingCities(
  apiBaseUrl: string,
  state: string,
  signal: AbortSignal
): Promise<string[]> {
  const res = await fetch(
    `${apiBaseUrl}/api/shipping/locations?state=${encodeURIComponent(state)}`,
    { signal }
  );
  if (!res.ok || signal.aborted) return [];

  const data = await res.json();
  const locations = Array.isArray(data.locations)
    ? (data.locations as ShippingLocation[])
    : [];
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
