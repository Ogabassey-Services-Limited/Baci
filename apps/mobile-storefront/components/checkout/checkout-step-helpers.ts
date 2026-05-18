import {
  PICKUP_STATION_ADDRESS_LINES,
} from '@/components/checkout/PickupStationCard';
import type {
  PaymentMethodType,
  PaymentTab,
} from '@/components/checkout/PaymentMethodSelector';
import type { DeliveryMethod, ShippingQuote } from '@/components/checkout/types';

export const AIRPORT_DELIVERY_FEE = 25000;
const DEFAULT_CARRIER = 'Topship';
const AIRPORT_DELIVERY_ESTIMATE = 'Est Delivery within 24-48 working hours';

export function getPaymentTabForMethod(method: PaymentMethodType): PaymentTab {
  if (method === 'credpal' || method === 'credit_direct') {
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
  if (deliveryMethod === 'airport') return AIRPORT_DELIVERY_FEE;
  if (deliveryMethod === 'pickup_station') return 0;
  return selectedQuote?.price ?? 0;
}

export function getDeliveryMethodLabel(deliveryMethod: DeliveryMethod): string {
  switch (deliveryMethod) {
    case 'airport':
      return 'Airport Delivery';
    case 'pickup_station':
      return 'Pick Up Station';
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
    return PICKUP_STATION_ADDRESS_LINES.join(', ');
  }

  const carrier =
    selectedQuote?.carrierName || selectedQuote?.provider || DEFAULT_CARRIER;
  const eta =
    selectedQuote?.deliveryRange ||
    (selectedQuote?.estimatedDays
      ? `${selectedQuote.estimatedDays} days`
      : 'Delivery estimate shown after selection');

  return `${carrier} • ${eta}`;
}

export function getShippingProviderForMethod(
  deliveryMethod: DeliveryMethod,
  selectedQuote: ShippingQuote | undefined
): string | undefined {
  if (deliveryMethod === 'airport') return 'Airport Delivery';
  if (deliveryMethod === 'pickup_station') return 'Pick Up Station';
  return selectedQuote?.provider || selectedQuote?.carrierName;
}
