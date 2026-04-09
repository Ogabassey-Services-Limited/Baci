import type { PaymentMethod } from './types';

export const CHECKOUT_PENDING_ORDER_STORAGE_KEY =
  'storefront-checkout-pending-order';

export interface PendingCheckoutOrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  variantId?: string;
  variantAttributes?: Record<string, string>;
  has_assurance?: boolean;
  assurance_fee?: number;
}

export interface PendingCheckoutFingerprintInput {
  merchantId: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: string;
  shippingFee: number;
  shippingProvider: string;
  selectedQuoteId?: string;
  shippingAddress: {
    address: string;
    city: string;
    state: string;
    phone?: string;
  };
  items: PendingCheckoutOrderItem[];
  useWalletCredit: boolean;
  walletAmountUsed: number;
}

export interface PendingCheckoutOrderSnapshot {
  orderId: string;
  orderNumber?: string;
  trackingToken?: string;
  merchantId: string;
  customerEmail: string;
  checkoutFingerprint: string;
  amountDueToGateway: number;
  createdAt: string;
}

export interface ReusedCheckoutOrder {
  id: string;
  order_number?: string;
  tracking_token?: string;
}

export interface ResolvePendingCheckoutOrderOptions {
  pendingOrder: PendingCheckoutOrderSnapshot | null;
  merchantId: string;
  merchantSlug?: string | null;
  customerEmail: string;
  checkoutFingerprint: string;
  paymentMethod: string;
  shippingProvider: string;
  selectedQuoteId?: string;
  fetchImpl?: typeof fetch;
}

export interface ResolvePendingCheckoutOrderResult {
  reusableOrder: {
    order: ReusedCheckoutOrder;
    amountDueToGateway: number;
  } | null;
  clearStoredOrder: boolean;
}

const NON_REUSABLE_SHIPPING_STATUSES = new Set([
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
]);

function normalizeText(value: string | undefined): string {
  return (value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeVariantAttributes(attributes?: Record<string, string>) {
  if (!attributes) return undefined;

  return Object.fromEntries(
    Object.entries(attributes)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, normalizeText(value)])
  );
}

export function normalizeOrderPaymentMethod(paymentMethod: PaymentMethod): string {
  if (paymentMethod === 'paystack' || paymentMethod === 'korapay') {
    return 'card';
  }

  if (
    paymentMethod === 'credit_direct' ||
    paymentMethod === 'credpal' ||
    paymentMethod === 'invoice' ||
    paymentMethod === 'juicyway' ||
    paymentMethod === 'bank_transfer' ||
    paymentMethod === 'payforme'
  ) {
    return paymentMethod;
  }

  return 'pod';
}

export function buildPendingCheckoutFingerprint(
  input: PendingCheckoutFingerprintInput
): string {
  const normalizedItems = [...input.items]
    .map((item) => ({
      product_id: item.product_id,
      name: normalizeText(item.name),
      quantity: item.quantity,
      price: item.price,
      variantId: item.variantId || undefined,
      variantAttributes: normalizeVariantAttributes(item.variantAttributes),
      has_assurance: Boolean(item.has_assurance),
      assurance_fee: item.assurance_fee || 0,
    }))
    .sort((left, right) =>
      `${left.product_id}:${left.variantId || ''}:${left.name}`.localeCompare(
        `${right.product_id}:${right.variantId || ''}:${right.name}`
      )
    );

  return JSON.stringify({
    merchantId: input.merchantId,
    customerEmail: normalizeText(input.customerEmail),
    customerName: normalizeText(input.customerName),
    customerPhone: normalizeText(input.customerPhone),
    deliveryMethod: input.deliveryMethod,
    shippingFee: input.shippingFee,
    shippingProvider: normalizeText(input.shippingProvider),
    selectedQuoteId: input.selectedQuoteId || null,
    shippingAddress: {
      address: normalizeText(input.shippingAddress.address),
      city: normalizeText(input.shippingAddress.city),
      state: normalizeText(input.shippingAddress.state),
      phone: normalizeText(input.shippingAddress.phone),
    },
    items: normalizedItems,
    useWalletCredit: input.useWalletCredit,
    walletAmountUsed: input.walletAmountUsed,
  });
}

function shouldClearStoredOrder(status: number): boolean {
  return status >= 400 && status < 500;
}

export async function resolvePendingCheckoutOrder({
  pendingOrder,
  merchantId,
  merchantSlug,
  customerEmail,
  checkoutFingerprint,
  paymentMethod,
  shippingProvider,
  selectedQuoteId,
  fetchImpl = fetch,
}: ResolvePendingCheckoutOrderOptions): Promise<ResolvePendingCheckoutOrderResult> {
  if (!pendingOrder) {
    return { reusableOrder: null, clearStoredOrder: false };
  }

  if (
    !pendingOrder.trackingToken ||
    pendingOrder.merchantId !== merchantId ||
    normalizeText(pendingOrder.customerEmail) !== normalizeText(customerEmail) ||
    pendingOrder.checkoutFingerprint !== checkoutFingerprint
  ) {
    return { reusableOrder: null, clearStoredOrder: true };
  }

  const orderParams = new URLSearchParams({
    tracking_token: pendingOrder.trackingToken,
  });

  if (merchantSlug) {
    orderParams.set('merchant_slug', merchantSlug);
  }

  const orderResponse = await fetchImpl(
    `/api/storefront/orders/${pendingOrder.orderId}?${orderParams.toString()}`
  );

  if (!orderResponse.ok) {
    if (shouldClearStoredOrder(orderResponse.status)) {
      return { reusableOrder: null, clearStoredOrder: true };
    }

    throw new Error('Failed to validate pending checkout order');
  }

  const existingOrder = (await orderResponse.json()) as {
    id?: string;
    total?: number | string;
    payment_status?: string;
    shipping_status?: string;
  };

  if (
    !existingOrder?.id ||
    existingOrder.payment_status === 'paid' ||
    NON_REUSABLE_SHIPPING_STATUSES.has(existingOrder.shipping_status || '')
  ) {
    return { reusableOrder: null, clearStoredOrder: true };
  }

  const reuseResponse = await fetchImpl('/api/orders/reuse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: pendingOrder.orderId,
      tracking_token: pendingOrder.trackingToken,
      merchant_id: merchantId,
      customer_email: customerEmail,
      payment_method: paymentMethod,
      shipping_provider: shippingProvider,
      selected_quote_id: selectedQuoteId || undefined,
    }),
  });

  if (!reuseResponse.ok) {
    if (shouldClearStoredOrder(reuseResponse.status)) {
      return { reusableOrder: null, clearStoredOrder: true };
    }

    throw new Error('Failed to reopen pending checkout order');
  }

  const reusedOrderData = (await reuseResponse.json()) as {
    order?: ReusedCheckoutOrder;
  };

  if (!reusedOrderData.order?.id) {
    return { reusableOrder: null, clearStoredOrder: true };
  }

  return {
    reusableOrder: {
      order: reusedOrderData.order,
      amountDueToGateway:
        pendingOrder.amountDueToGateway ||
        Number(existingOrder.total || 0),
    },
    clearStoredOrder: false,
  };
}
