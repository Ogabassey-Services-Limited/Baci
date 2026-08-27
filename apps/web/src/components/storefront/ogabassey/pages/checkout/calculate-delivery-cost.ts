import type { DeliveryMethod, ShippingQuote } from './types';

const AIRPORT_DELIVERY_FEE = 35_000;
const AIRPORT_PICKUP_FEE = 20_000;

export function isStationPickupQuote(quote: ShippingQuote): boolean {
  return quote.isStationPickup === true;
}

export function isGiglGoFasterQuote(quote: ShippingQuote | undefined): boolean {
  return (
    quote !== undefined &&
    !isStationPickupQuote(quote) &&
    quote.provider.toUpperCase() === 'GIGL' &&
    quote.serviceTier.toLowerCase().includes('gofaster')
  );
}

/** Calculate the delivery cost based on the selected method and quote. */
export function calculateDeliveryCost(
  deliveryMethod: DeliveryMethod,
  selectedQuoteId: string,
  shippingQuotes: ShippingQuote[],
  airportType: 'delivery' | 'pickup',
): number {
  if (deliveryMethod === 'pickup') return 0;

  if (deliveryMethod === 'door' || deliveryMethod === 'pickup_station') {
    if (!selectedQuoteId) return 0;
    const selectedQuote = shippingQuotes.find(
      (quote) => String(quote.id) === String(selectedQuoteId),
    );
    if (!selectedQuote) return 0;
    if (deliveryMethod === 'door' && isStationPickupQuote(selectedQuote)) {
      return 0;
    }
    if (
      deliveryMethod === 'pickup_station' &&
      !isStationPickupQuote(selectedQuote)
    ) {
      return 0;
    }
    return selectedQuote.price;
  }

  const selectedAirQuote = shippingQuotes.find(
    (quote) => String(quote.id) === String(selectedQuoteId),
  );
  if (selectedAirQuote && isGiglGoFasterQuote(selectedAirQuote)) {
    return selectedAirQuote.price;
  }
  return airportType === 'delivery' ? AIRPORT_DELIVERY_FEE : AIRPORT_PICKUP_FEE;
}
