import type { ShippingLocation } from '@/components/checkout/checkout-shipping.helpers';

export async function fetchCheckoutShippingStates(
  apiBaseUrl: string
): Promise<string[]> {
  const res = await fetch(`${apiBaseUrl}/api/shipping/locations`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.states) ? data.states : [];
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
  const normalizedState = state.trim().toLowerCase();
  return [
    ...new Set(
      locations
        .filter((location: ShippingLocation) => {
          const locationState = location.state?.trim().toLowerCase();
          return locationState ? locationState === normalizedState : true;
        })
        .map((location) => location.city)
    ),
  ].sort();
}
