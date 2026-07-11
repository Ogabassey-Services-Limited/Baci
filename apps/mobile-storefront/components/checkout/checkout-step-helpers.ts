import {
  getPickupStationAddressText,
  getPickupStationLabel,
  isProviderStationPickupQuote,
} from '@/components/checkout/checkout-station-pickup';
import type {
  PaymentMethodType,
  PaymentTab,
} from '@/components/checkout/PaymentMethodSelector';
import { PICKUP_STATION_ADDRESS_LINES } from '@/components/checkout/pickup-station.constants';
import type {
  DeliveryMethod,
  ShippingQuote,
  ShippingQuoteDeliveryPreference,
} from '@/components/checkout/types';

export const AIRPORT_DELIVERY_FEE = 25000;
export const AIRPORT_QUOTE_ID = 'airport-delivery';
const DEFAULT_CARRIER = 'Topship';
const AIRPORT_DELIVERY_ESTIMATE =
  'Delivery to your doorstep • Est Delivery within 24-48 working hours';

export function getPaymentTabForMethod(method: PaymentMethodType): PaymentTab {
  if (
    method === 'credpal' ||
    method === 'credit_direct' ||
    method === 'klump'
  ) {
    return 'installments';
  }

  if (method === 'invoice' || method === 'payforme') {
    return 'pay_later';
  }

  return 'full';
}

export function getDeliveryMethodFee(
  deliveryMethod: DeliveryMethod,
  selectedQuote: ShippingQuote | undefined
): number {
  if (deliveryMethod === 'airport') {
    return selectedQuote && isGiglGoFasterQuote(selectedQuote)
      ? selectedQuote.price
      : AIRPORT_DELIVERY_FEE;
  }
  if (deliveryMethod === 'pickup_station') {
    return isProviderStationPickupQuote(selectedQuote)
      ? selectedQuote.price
      : 0;
  }
  return isRoadDeliveryQuote(selectedQuote) ? selectedQuote.price : 0;
}

export function getQuotePreference(
  deliveryMethod: DeliveryMethod
): ShippingQuoteDeliveryPreference {
  return deliveryMethod === 'pickup_station' ? 'pickup_station' : 'door';
}

export function getDeliveryMethodLabel(
  deliveryMethod: DeliveryMethod,
  selectedQuote?: ShippingQuote
): string {
  switch (deliveryMethod) {
    case 'airport':
      return 'Airport Delivery';
    case 'pickup_station':
      return getPickupStationLabel(selectedQuote);
    default:
      return 'Door Delivery';
  }
}

export function getDeliveryMethodSummary(
  deliveryMethod: DeliveryMethod,
  selectedQuote: ShippingQuote | undefined
): string {
  if (deliveryMethod === 'airport') {
    return AIRPORT_DELIVERY_ESTIMATE;
  }

  if (deliveryMethod === 'pickup_station') {
    return isProviderStationPickupQuote(selectedQuote)
      ? getPickupStationAddressText(selectedQuote)
      : PICKUP_STATION_ADDRESS_LINES.join(', ');
  }

  const doorQuote = isRoadDeliveryQuote(selectedQuote)
    ? selectedQuote
    : undefined;
  const carrier =
    doorQuote?.carrierName || doorQuote?.provider || DEFAULT_CARRIER;
  const eta =
    doorQuote?.deliveryRange ||
    (doorQuote?.estimatedDays
      ? `${doorQuote.estimatedDays} days`
      : 'Delivery estimate shown after selection');

  return `${carrier} • ${eta}`;
}

export function getShippingProviderForMethod(
  deliveryMethod: DeliveryMethod,
  selectedQuote: ShippingQuote | undefined
): string | undefined {
  if (deliveryMethod === 'pickup_station') {
    return isProviderStationPickupQuote(selectedQuote)
      ? selectedQuote.provider || selectedQuote.carrierName
      : undefined;
  }
  if (deliveryMethod === 'airport') {
    return selectedQuote && isGiglGoFasterQuote(selectedQuote)
      ? selectedQuote.provider || selectedQuote.carrierName
      : undefined;
  }
  if (deliveryMethod !== 'door') return undefined;
  return isRoadDeliveryQuote(selectedQuote)
    ? selectedQuote.provider || selectedQuote.carrierName
    : undefined;
}

export function isGiglGoFasterQuote(quote: ShippingQuote | undefined): boolean {
  return (
    quote !== undefined &&
    !isProviderStationPickupQuote(quote) &&
    quote.provider?.toUpperCase() === 'GIGL' &&
    quote.serviceTier?.toLowerCase().includes('gofaster') === true
  );
}

export function isRoadDeliveryQuote(
  quote: ShippingQuote | undefined
): quote is ShippingQuote {
  return (
    quote !== undefined &&
    !isProviderStationPickupQuote(quote) &&
    !isGiglGoFasterQuote(quote)
  );
}

export function findSelectedQuote(
  shippingQuotes: ShippingQuote[],
  selectedQuoteId: string
): ShippingQuote | undefined {
  return shippingQuotes.find(
    (quote) => String(quote.id) === String(selectedQuoteId)
  );
}

export function requiresQuote(
  deliveryMethod: DeliveryMethod,
  selectedQuote: ShippingQuote | undefined,
  usesProviderPickup: boolean
): boolean {
  return (
    deliveryMethod === 'door' ||
    usesProviderPickup ||
    (deliveryMethod === 'airport' && isGiglGoFasterQuote(selectedQuote))
  );
}
