import {
  buildOrderShipmentReceiver,
  type OrderForShipmentReceiver,
} from './build-order-shipment-receiver';
import type { QuoteRequest, ShippingAddress } from './types';

const ADMIN_GIGL_ORDER_PROVENANCE = 'server_gigl_v1';
const ADMIN_GIGL_DEFAULT_WEIGHT_KG = 1;
const DOMESTIC_DEFAULT_WEIGHT_KG = 1;

export function resolveAdminGiglBookingContext(
  provider: string | null | undefined,
  order: OrderForShipmentReceiver,
  quoteRequest: QuoteRequest | null | undefined
): { receiver: ShippingAddress; defaultWeight: number } {
  const isAdminGiglDomesticQuote =
    provider === 'GIGL' &&
    quoteRequest?.shipmentType === 'domestic' &&
    quoteRequest.admin_order_provenance === ADMIN_GIGL_ORDER_PROVENANCE;
  const orderReceiver = buildOrderShipmentReceiver(order, {
    allowCoordinatesWithoutCityState: isAdminGiglDomesticQuote,
  });
  return {
    receiver:
      isAdminGiglDomesticQuote && quoteRequest
        ? {
            ...orderReceiver,
            latitude: quoteRequest.receiver.latitude ?? orderReceiver.latitude,
            longitude:
              quoteRequest.receiver.longitude ?? orderReceiver.longitude,
          }
        : orderReceiver,
    defaultWeight: isAdminGiglDomesticQuote
      ? ADMIN_GIGL_DEFAULT_WEIGHT_KG
      : DOMESTIC_DEFAULT_WEIGHT_KG,
  };
}
