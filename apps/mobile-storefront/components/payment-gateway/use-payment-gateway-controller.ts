import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { WebView } from 'react-native-webview';
import { useToast } from '@/components/ui/Toast';
import { setClipboardString } from '@/lib/clipboard';
import { useCartStore } from '@/stores/cart-store';
import { createPaymentGatewayMessageHandler } from './create-payment-gateway-message-handler';
import {
  isPaymentGateway,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_KINDS,
} from './payment-gateway.helpers';
import {
  beginSavingsAuthorizationCompletion,
  beginWalletTopUpCompletion,
} from './payment-gateway-completions';
import {
  getCloseConfirmationMessage,
  parsePaymentGatewayParams,
} from './payment-gateway-controller.helpers';
import type {
  PaymentGatewayRefs,
  PaymentGatewayStatus,
} from './payment-gateway-controller.types';
import { createPaymentGatewayEventHandlers } from './payment-gateway-event-handlers';
import { createPaymentGatewayTimers } from './payment-gateway-timers';
import { handleVtuConfirmation } from './use-vtu-payment-completion';

// React Compiler forbids passing refs to plain function calls during render but
// allows passing them to hooks. These wrappers classify the render-time handler
// factories as hooks; like before, they re-run on every render.
function usePaymentGatewayTimers(
  input: Parameters<typeof createPaymentGatewayTimers>[0]
) {
  return createPaymentGatewayTimers(input);
}

function usePaymentGatewayMessageHandler(
  input: Parameters<typeof createPaymentGatewayMessageHandler>[0]
) {
  return createPaymentGatewayMessageHandler(input);
}

function usePaymentGatewayEventHandlers(
  input: Parameters<typeof createPaymentGatewayEventHandlers>[0]
) {
  return createPaymentGatewayEventHandlers(input);
}

export function usePaymentGatewayController() {
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<Record<string, string>>();
  const webViewRef = useRef<WebView>(null);
  const copiedGatewayTextRef = useRef<string | null>(null);
  const paymentCompletionStartedRef = useRef(false);
  const savingsAuthorizationAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const vtuConfirmationTokenRef = useRef(0);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCart = useCartStore((state) => state.clearCart);
  const toast = useToast();
  const [status, setStatusState] = useState<PaymentGatewayStatus>('loading');
  const statusRef = useRef<PaymentGatewayStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const gatewayRefs: PaymentGatewayRefs = {
    copiedGatewayTextRef,
    isMountedRef,
    loadTimeoutRef,
    navigationTimeoutRef,
    paymentCompletionStartedRef,
    savingsAuthorizationAbortRef,
    statusRef,
    vtuConfirmationTokenRef,
    webViewRef,
  };

  const setPaymentStatus = (
    nextStatus:
      | PaymentGatewayStatus
      | ((currentStatus: PaymentGatewayStatus) => PaymentGatewayStatus)
  ) => {
    const resolvedStatus =
      typeof nextStatus === 'function'
        ? nextStatus(statusRef.current)
        : nextStatus;
    statusRef.current = resolvedStatus;
    setStatusState(resolvedStatus);
  };

  useEffect(
    () => () => {
      isMountedRef.current = false;
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      savingsAuthorizationAbortRef.current?.abort();
      savingsAuthorizationAbortRef.current = null;
    },
    []
  );

  const {
    clearPendingLoadTimeout,
    clearPendingNavigation,
    scheduleDelayedNavigation,
    scheduleLoadTimeout,
  } = usePaymentGatewayTimers({
    refs: gatewayRefs,
    setErrorMessage,
    setPaymentStatus,
  });

  const validatedParams = parsePaymentGatewayParams(params);

  const {
    amount,
    authorizationUrl,
    customerIdentifier,
    gateway,
    merchantId,
    merchantSlug,
    orderId,
    orderNumber,
    paymentKind,
    reference,
    returnTo,
    trackingToken,
    utilityType,
  } = validatedParams.data || {};
  const gatewayName =
    gateway && isPaymentGateway(gateway)
      ? PAYMENT_GATEWAY_LABELS[gateway]
      : 'Payment';

  const isCurrentVtuConfirmation = (confirmationToken: number) =>
    isMountedRef.current &&
    vtuConfirmationTokenRef.current === confirmationToken;

  const beginVtuPaymentCompletion = (input?: {
    amount?: number;
    customerIdentifier?: string;
    reference?: string;
  }) => {
    const currentStatus = statusRef.current;
    if (
      paymentCompletionStartedRef.current ||
      currentStatus === 'processing' ||
      currentStatus === 'success'
    ) {
      return;
    }

    paymentCompletionStartedRef.current = true;
    clearPendingLoadTimeout();
    setPaymentStatus('processing');
    void handleVtuConfirmation({
      amount,
      customerIdentifier,
      fallbackAmount: input?.amount,
      fallbackCustomerIdentifier: input?.customerIdentifier,
      gateway,
      isMountedRef,
      isCurrentVtuConfirmation,
      nextReference: input?.reference ?? reference,
      scheduleDelayedNavigation,
      setErrorMessage,
      setStatus: setPaymentStatus,
      utilityType,
      vtuConfirmationTokenRef,
    });
  };

  const beginPaymentCompletion = () => {
    const currentStatus = statusRef.current;
    if (
      paymentCompletionStartedRef.current ||
      currentStatus === 'processing' ||
      currentStatus === 'success'
    ) {
      return;
    }

    if (paymentKind === PAYMENT_KINDS.VTU) {
      beginVtuPaymentCompletion();
      return;
    }

    if (paymentKind === PAYMENT_KINDS.WALLET) {
      beginWalletTopUpCompletion({
        clearPendingLoadTimeout,
        gateway,
        merchantId,
        merchantSlug,
        queryClient,
        reference,
        refs: gatewayRefs,
        returnTo,
        scheduleDelayedNavigation,
        setErrorMessage,
        setPaymentStatus,
      });
      return;
    }

    if (paymentKind === PAYMENT_KINDS.SAVINGS_AUTH) {
      beginSavingsAuthorizationCompletion({
        clearPendingLoadTimeout,
        gateway,
        merchantId,
        merchantSlug,
        queryClient,
        reference,
        refs: gatewayRefs,
        returnTo,
        scheduleDelayedNavigation,
        setErrorMessage,
        setPaymentStatus,
      });
      return;
    }

    paymentCompletionStartedRef.current = true;
    clearPendingLoadTimeout();
    setPaymentStatus('success');
    clearCart();
    scheduleDelayedNavigation(() => {
      router.replace({
        pathname: '/order-success',
        params: {
          orderId: orderId || '',
          orderNumber: orderNumber || '',
          paymentMethod: gateway,
          reference: reference || '',
          ...(trackingToken && { trackingToken }),
        },
      });
    });
  };

  const copyGatewayText = async (
    text: string,
    successMessage: string,
    failureMessage = 'Unable to copy text.'
  ) => {
    const copied = await setClipboardString(text);
    if (copied) {
      toast.success(successMessage);
    } else {
      toast.error(failureMessage);
    }
  };

  const handleWebViewMessage = usePaymentGatewayMessageHandler({
    amount,
    clearCart,
    confirmVtuPaymentSuccess: beginVtuPaymentCompletion,
    copiedGatewayTextRef,
    copyGatewayText,
    customerIdentifier,
    gateway,
    orderId,
    orderNumber,
    paymentKind,
    reference,
    trackingToken,
    utilityType,
    markPaymentCompletionStarted: () => {
      paymentCompletionStartedRef.current = true;
    },
    scheduleDelayedNavigation,
    setSuccessStatus: () => setPaymentStatus('success'),
  });

  const handleClose = () => {
    Alert.alert('Cancel Payment?', getCloseConfirmationMessage(paymentKind), [
      { text: 'Continue Payment', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.back() },
    ]);
  };
  const eventHandlers = usePaymentGatewayEventHandlers({
    beginPaymentCompletion,
    clearPendingLoadTimeout,
    clearPendingNavigation,
    paymentKind,
    refs: gatewayRefs,
    returnTo,
    scheduleDelayedNavigation,
    scheduleLoadTimeout,
    setErrorMessage,
    setPaymentStatus,
  });

  return {
    amount,
    authorizationUrl,
    errorMessage,
    gatewayName,
    // Alias retained for checkout back-button consumers; both paths confirm cancellation.
    handleBack: handleClose,
    handleClose,
    ...eventHandlers,
    handleWebViewMessage,
    paymentKind,
    status,
    toast,
    utilityType,
    validatedParams,
    webViewRef,
  };
}
