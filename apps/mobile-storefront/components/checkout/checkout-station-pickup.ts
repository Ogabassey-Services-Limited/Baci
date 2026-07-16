import { isPickupEligible } from '@baci/shared';
import type { DeliveryMethod, ShippingQuote } from './types';

export type ProviderStationPickupQuote = ShippingQuote & {
  isStationPickup: true;
};

export function isProviderStationPickupQuote(
  quote: ShippingQuote | null | undefined
): quote is ProviderStationPickupQuote {
  return quote?.isStationPickup === true;
}

export function getStationPickupQuote(
  quotes: ShippingQuote[]
): ShippingQuote | undefined {
  return quotes.find(isProviderStationPickupQuote);
}

export function getPickupStationLabel(quote?: ShippingQuote): string {
  if (!isProviderStationPickupQuote(quote)) {
    return 'Pick Up Station';
  }

  const providerName = quote.provider || quote.carrierName || 'Provider';
  return `Pickup Stations (${providerName})`;
}

export function getPickupStationAddressLines(quote?: ShippingQuote): string[] {
  if (!isProviderStationPickupQuote(quote)) {
    return [];
  }

  const stationName = quote.stationName ?? quote.pickupStationName;
  const stationAddress = quote.stationAddress ?? quote.pickupStationAddress;
  const lines = [stationName, stationAddress].filter((line): line is string =>
    Boolean(line)
  );

  return lines.length > 0 ? lines : [quote.displayName];
}

export function getPickupStationAddressText(
  quote: ShippingQuote | undefined,
  separator = ', '
): string {
  return getPickupStationAddressLines(quote).join(separator);
}

export function getPickupStationMode({
  city,
  deliveryMethod,
  state,
  stationPickupQuote,
}: {
  city: string;
  deliveryMethod: DeliveryMethod;
  state: string;
  stationPickupQuote?: ShippingQuote;
}) {
  const hasResolvedDeliveryLocation = Boolean(state && city);
  const usesMerchantPickup =
    deliveryMethod === 'pickup_station' && isPickupEligible(state);
  const usesProviderPickup =
    deliveryMethod === 'pickup_station' &&
    hasResolvedDeliveryLocation &&
    !isPickupEligible(state);
  // Availability is broader than active usage so customers can select pickup
  // before the provider quote has been fetched.
  const canUsePickupStation =
    isPickupEligible(state) ||
    stationPickupQuote !== undefined ||
    hasResolvedDeliveryLocation;

  return {
    canUsePickupStation,
    hasResolvedDeliveryLocation,
    usesMerchantPickup,
    usesProviderPickup,
  };
}

export function getShippingQuoteMode({
  city,
  deliveryMethod,
  resolvedPreference,
  resolvedQuoteKey,
  shippingQuoteContextKey,
  shippingQuotes,
  state,
}: {
  city: string;
  deliveryMethod: DeliveryMethod;
  resolvedPreference: '' | 'door' | 'pickup_station';
  resolvedQuoteKey: string;
  shippingQuoteContextKey: string;
  shippingQuotes: ShippingQuote[];
  state: string;
}) {
  const stationQuote = getStationPickupQuote(shippingQuotes);
  const pickupMode = getPickupStationMode({
    city,
    deliveryMethod,
    state,
    stationPickupQuote: stationQuote,
  });
  const currentQuotePreference =
    deliveryMethod === 'pickup_station' ? 'pickup_station' : 'door';
  const isCurrentQuoteContext =
    shippingQuoteContextKey !== '' &&
    resolvedQuoteKey === shippingQuoteContextKey &&
    resolvedPreference === currentQuotePreference;

  return {
    ...pickupMode,
    currentQuotePreference,
    isCurrentQuoteContext,
    stationPickupQuote: isCurrentQuoteContext ? stationQuote : undefined,
    usesDoorQuotes: deliveryMethod === 'door' || deliveryMethod === 'airport',
    usesPickupQuotes:
      deliveryMethod === 'pickup_station' &&
      pickupMode.hasResolvedDeliveryLocation,
  };
}
