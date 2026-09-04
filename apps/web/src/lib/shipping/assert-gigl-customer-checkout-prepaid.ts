import { OrderShipmentBookingError } from './order-shipment-booking-utils';

type GiglBookingPaymentContext = {
  payment_method?: string | null;
  payment_status?: string | null;
  shipping_funding_source?: 'customer_checkout' | 'merchant_wallet' | null;
  shipping_provider?: string | null;
};

export function isPayOnDeliveryPaymentMethod(
  paymentMethod: string | null | undefined
): boolean {
  const normalized = (paymentMethod ?? '').trim().toLowerCase();
  return normalized === 'pod' || normalized === 'pay_on_delivery';
}

export function assertGiglCustomerCheckoutPrepaid(
  order: GiglBookingPaymentContext
): void {
  if (order.shipping_provider !== 'GIGL') {
    return;
  }

  if (order.shipping_funding_source === 'merchant_wallet') {
    return;
  }

  const paymentStatus = (order.payment_status ?? '').trim().toLowerCase();
  const requiresPrepaidShipping =
    paymentStatus !== 'paid' ||
    isPayOnDeliveryPaymentMethod(order.payment_method);

  if (!requiresPrepaidShipping) {
    return;
  }

  throw new OrderShipmentBookingError(
    'GIGL shipping must be prepaid at checkout or funded from the merchant wallet before booking.',
    400,
    'GIGL_REQUIRES_PREPAID_OR_WALLET'
  );
}
