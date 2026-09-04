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

/**
 * Authoritative prepaid shipping proof: customer_checkout funding with a
 * positive retained amount. Never infer retention from Paystack/Korapay/etc.
 * when shipping_funding_source is null — payment method alone is not proof
 * GIGL shipping was retained at checkout.
 */
export function hasGiglCheckoutShippingRetention(
  order: Pick<
    GiglBookingPaymentContext,
    'shipping_funding_source' | 'shipping_platform_retained_amount'
  >
): boolean {
  if (order.shipping_funding_source !== 'customer_checkout') {
    return false;
  }

  return (
    parseRetainedShippingAmount(order.shipping_platform_retained_amount) > 0
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
