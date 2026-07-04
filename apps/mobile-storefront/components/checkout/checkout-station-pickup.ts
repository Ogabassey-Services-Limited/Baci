import { PICKUP_STATION_ADDRESS_LINES } from './pickup-station.constants';
import type { ShippingQuote } from './types';

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
    return [...PICKUP_STATION_ADDRESS_LINES];
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
