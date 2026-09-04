import { OrderShipmentBookingError } from './order-shipment-booking-utils';

type GiglBookingPaymentContext = {
  payment_method?: string | null;
  payment_status?: string | null;
  shipping_funding_source?: 'customer_checkout' | 'merchant_wallet' | null;
  shipping_platform_retained_amount?: number | string | null;
  shipping_provider?: string | null;
};

const GIGL_CHECKOUT_PAYMENT_METHODS_WITHOUT_RETENTION = new Set([
  'pod',
  'pay_on_delivery',
  'credit_direct',
  'credit-direct',
  'manual',
  'manual_payment',
  'cash',
]);

const GIGL_SETTLEMENT_GATEWAY_PAYMENT_METHODS = new Set([
  'paystack',
  'korapay',
  'juicyway',
  'klump',
]);

function normalizePaymentMethod(
  paymentMethod: string | null | undefined
): string {
  return (paymentMethod ?? '').trim().toLowerCase();
}

function parseRetainedShippingAmount(
  value: number | string | null | undefined
): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? Math.max(0, parsed)
    : 0;
}

export function isPayOnDeliveryPaymentMethod(
  paymentMethod: string | null | undefined
): boolean {
  const normalized = normalizePaymentMethod(paymentMethod);
  return normalized === 'pod' || normalized === 'pay_on_delivery';
}

export function isGiglCheckoutPaymentWithoutRetainedShipping(
  paymentMethod: string | null | undefined
): boolean {
  return GIGL_CHECKOUT_PAYMENT_METHODS_WITHOUT_RETENTION.has(
    normalizePaymentMethod(paymentMethod)
  );
}

export function hasGiglCheckoutShippingRetention(
  order: Pick<
    GiglBookingPaymentContext,
    | 'payment_method'
    | 'shipping_funding_source'
    | 'shipping_platform_retained_amount'
  >
): boolean {
  const retainedAmount = parseRetainedShippingAmount(
    order.shipping_platform_retained_amount
  );
  if (retainedAmount > 0) {
    return true;
  }

  if (order.shipping_funding_source != null) {
    return false;
  }

  return GIGL_SETTLEMENT_GATEWAY_PAYMENT_METHODS.has(
    normalizePaymentMethod(order.payment_method)
  );
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
  const paymentMethod = normalizePaymentMethod(order.payment_method);
  const requiresPrepaidShipping =
    paymentStatus !== 'paid' ||
    isPayOnDeliveryPaymentMethod(order.payment_method) ||
    isGiglCheckoutPaymentWithoutRetainedShipping(paymentMethod) ||
    !hasGiglCheckoutShippingRetention(order);

  if (!requiresPrepaidShipping) {
    return;
  }

  throw new OrderShipmentBookingError(
    'GIGL shipping must be prepaid at checkout or funded from the merchant wallet before booking.',
    400,
    'GIGL_REQUIRES_PREPAID_OR_WALLET'
  );
}
