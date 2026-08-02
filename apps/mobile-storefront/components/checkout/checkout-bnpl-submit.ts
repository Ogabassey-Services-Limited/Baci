import { router } from 'expo-router';
import type { MutableRefObject } from 'react';
import { Alert } from 'react-native';
import type { PaymentMethodType } from '@/components/checkout/PaymentMethodSelector';
import type {
  DeliveryMethod,
  ShippingQuote,
} from '@/components/checkout/types';
import {
  buildMobileCheckoutOrderFingerprint,
  clearMobileCheckoutIdempotencyKey,
  getMobileCheckoutIdempotencyKey,
  type MobileCheckoutIdempotencyState,
} from '@/lib/checkout-order-idempotency';
import {
  buildKlumpBnplRouteParams,
  buildKlumpInitializePayload,
  getKlumpDisabledReason,
} from '@/lib/klump-checkout';
import type { ShippingAddressInput } from '@/lib/validation';
import type {
  SavingsSelection,
  WalletSelection,
} from '@/lib/wallet-payment-helpers';
import { createOrder, OrderError, type OrderResponse } from '@/services/orders';
import type { CartItem } from '@/stores/cart-store';
import {
  buildCheckoutOrderRequest,
  type CheckoutSnapshot,
} from './checkout-order-builders';
import {
  CHECKOUT_API_BASE_URL,
  CHECKOUT_MERCHANT_DOMAIN,
  CHECKOUT_MERCHANT_ID,
  CHECKOUT_MERCHANT_SLUG,
} from './checkout-screen.constants';

const BNPL_PAYMENT_INIT_TIMEOUT_MS = 10_000;

interface SubmitBnplCheckoutParams {
  address: ShippingAddressInput;
  appliedDiscountCode?: string | null;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  getShippingProvider: () => string | undefined;
  isOrderInFlight: MutableRefObject<boolean>;
  itemsSnapshot: CartItem[];
  liveSavingsSelection: SavingsSelection | undefined;
  liveWalletSelection: WalletSelection | undefined;
  mobileCheckoutIdempotencyRef: MutableRefObject<MobileCheckoutIdempotencyState | null>;
  paymentMethodForOrder: string;
  paymentSettings: Parameters<typeof getKlumpDisabledReason>[0];
  selectedPayment: PaymentMethodType;
  selectedQuote: ShippingQuote | undefined;
  setIsProcessing: (value: boolean) => void;
  snapshot: CheckoutSnapshot;
}

export async function submitBnplCheckout({
  address,
  appliedDiscountCode,
  customerEmail,
  customerName,
  customerPhone,
  deliveryMethod,
  getShippingProvider,
  isOrderInFlight,
  itemsSnapshot,
  liveSavingsSelection,
  liveWalletSelection,
  mobileCheckoutIdempotencyRef,
  paymentMethodForOrder,
  paymentSettings,
  selectedPayment,
  selectedQuote,
  setIsProcessing,
  snapshot,
}: SubmitBnplCheckoutParams) {
  const klumpSubmitDisabledReason =
    selectedPayment === 'klump'
      ? getKlumpDisabledReason(
          paymentSettings,
          snapshot.total,
          liveWalletSelection,
          liveSavingsSelection
        )
      : undefined;

  if (klumpSubmitDisabledReason) {
    Alert.alert('Klump unavailable', klumpSubmitDisabledReason, [
      { text: 'OK' },
    ]);
    isOrderInFlight.current = false;
    setIsProcessing(false);
    return;
  }

  const orderRequest = buildCheckoutOrderRequest({
    address,
    customerEmail,
    customerName,
    customerPhone,
    deliveryMethod,
    discountCode: appliedDiscountCode,
    itemsSnapshot,
    paymentMethodForOrder,
    selectedQuote,
    shippingProvider: getShippingProvider(),
    snapshot,
  });
  const mobileCheckoutFingerprint = buildMobileCheckoutOrderFingerprint({
    customerEmail,
    customerName,
    customerPhone,
    deliveryMethod,
    discountAmount: 0,
    discountCode: appliedDiscountCode,
    items: orderRequest.items,
    selectedQuoteId: orderRequest.selected_quote_id,
    shippingRateId: orderRequest.shipping_rate_id,
    shippingAddress: orderRequest.shipping_address,
    shippingFee: orderRequest.shipping_fee,
    shippingProvider: orderRequest.shipping_provider,
    subtotal: orderRequest.subtotal,
    taxAmount: orderRequest.tax_amount,
  });
  const mobileCheckoutIdempotencyKey = getMobileCheckoutIdempotencyKey(
    mobileCheckoutIdempotencyRef,
    mobileCheckoutFingerprint
  );

  let orderResponse: OrderResponse;
  try {
    orderResponse = await createOrder({
      ...orderRequest,
      idempotency_key: mobileCheckoutIdempotencyKey,
    });
  } catch (error) {
    if (
      error instanceof OrderError &&
      (error.code === 'CHECKOUT_ORDER_NOT_REUSABLE' ||
        error.code === 'CHECKOUT_IDEMPOTENCY_CONFLICT')
    ) {
      clearMobileCheckoutIdempotencyKey(
        mobileCheckoutIdempotencyRef,
        mobileCheckoutFingerprint
      );
    }

    throw error;
  }

  if (selectedPayment === 'klump') {
    await initializeKlumpAndRoute({
      customerEmail,
      customerName,
      customerPhone,
      orderId: orderResponse.order.id,
      orderTotal: Number(orderResponse.order.total),
      setIsProcessing,
      trackingToken: orderResponse.order.tracking_token,
    });
    isOrderInFlight.current = false;
    return;
  }

  isOrderInFlight.current = false;
  setIsProcessing(false);
  router.push({
    pathname: '/bnpl-checkout',
    params: {
      orderId: orderResponse.order.id,
      gateway: selectedPayment,
      amount: String(orderResponse.amountDueToGateway),
      customerEmail,
      customerName,
      customerPhone,
      merchantSlug: CHECKOUT_MERCHANT_SLUG,
      ...(CHECKOUT_MERCHANT_DOMAIN && {
        merchantDomain: CHECKOUT_MERCHANT_DOMAIN,
      }),
      ...(orderResponse.order.tracking_token && {
        trackingToken: orderResponse.order.tracking_token,
      }),
    },
  });
}

async function initializeKlumpAndRoute({
  customerEmail,
  customerName,
  customerPhone,
  orderId,
  orderTotal,
  setIsProcessing,
  trackingToken,
}: {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  orderId: string;
  orderTotal: number;
  setIsProcessing: (value: boolean) => void;
  trackingToken?: string | null;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    BNPL_PAYMENT_INIT_TIMEOUT_MS
  );
  let initResponse: Response;
  try {
    initResponse = await fetch(
      `${CHECKOUT_API_BASE_URL}/api/payments/initialize`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `payment-init-${orderId}-klump`,
        },
        body: JSON.stringify(
          buildKlumpInitializePayload({
            customerEmail,
            customerName,
            customerPhone,
            merchantId: CHECKOUT_MERCHANT_ID,
            orderId,
          })
        ),
      }
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OrderError(
        'Payment initialization timed out',
        'PAYMENT_INIT_TIMEOUT'
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const initData = await initResponse.json();
  if (
    !initResponse.ok ||
    !initData.success ||
    typeof initData.authorization_url !== 'string' ||
    typeof initData.reference !== 'string'
  ) {
    throw new OrderError(
      initData.error || 'Failed to initialize Klump payment',
      'PAYMENT_INIT_ERROR'
    );
  }

  setIsProcessing(false);
  router.push({
    pathname: '/bnpl-checkout',
    params: buildKlumpBnplRouteParams({
      amount: orderTotal,
      authorizationUrl: initData.authorization_url,
      customerEmail,
      customerName,
      customerPhone,
      orderId,
      reference: initData.reference,
      merchantSlug: CHECKOUT_MERCHANT_SLUG,
      ...(CHECKOUT_MERCHANT_DOMAIN && {
        merchantDomain: CHECKOUT_MERCHANT_DOMAIN,
      }),
      trackingToken,
    }),
  });
}
