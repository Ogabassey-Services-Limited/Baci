import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { WebView, WebViewNavigation } from 'react-native-webview';
import { useToast } from '@/components/ui/Toast';
import { setClipboardString } from '@/lib/clipboard';
import {
  type WalletTopUpGateway,
  WalletTopUpStillProcessingError,
  waitForWalletTopUpConfirmation,
} from '@/lib/wallet-top-up';
import { PaymentGatewayParamsSchema } from '@/schemas/payment-gateway';
import { useCartStore } from '@/stores/cart-store';
import { createPaymentGatewayMessageHandler } from './create-payment-gateway-message-handler';
import {
  isPaymentCancellationRedirect,
  isPaymentCompletionRedirect,
  isPaymentGateway,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_KINDS,
} from './payment-gateway.helpers';
import { handleVtuConfirmation } from './use-vtu-payment-completion';

type WebViewErrorEvent = Parameters<
  NonNullable<ComponentProps<typeof WebView>['onError']>
>[0];
type PaymentGatewayStatus =
  | 'loading'
  | 'ready'
  | 'processing'
  | 'success'
  | 'error';

const PAYMENT_LOAD_TIMEOUT_MS = 45_000;
const PAYMENT_SUCCESS_NAV_DELAY_MS = 1500;
const PAYMENT_LOAD_TIMEOUT_MESSAGE =
  'Payment page is taking longer than expected. Check your connection and try again.';
const WALLET_QUERY_KEY = ['wallet'] as const;

function isWalletTopUpGateway(value: unknown): value is WalletTopUpGateway {
  return value === 'paystack' || value === 'korapay';
}

function getCloseConfirmationMessage(paymentKind?: string) {
  switch (paymentKind) {
    case PAYMENT_KINDS.VTU:
      return 'If you leave now, this utility payment may remain incomplete until you retry it.';
    case PAYMENT_KINDS.WALLET:
      return 'If you leave now, your wallet top-up may remain incomplete until you retry it.';
    default:
      return 'Your order has been created. If you leave, you can complete payment later from your orders page.';
  }
}

export function usePaymentGatewayController() {
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<Record<string, string>>();
  const webViewRef = useRef<WebView>(null);
  const copiedGatewayTextRef = useRef<string | null>(null);
  const paymentCompletionStartedRef = useRef(false);
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
    },
    []
  );

  const clearPendingNavigation = () => {
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
  };

  const clearPendingLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  const scheduleLoadTimeout = () => {
    if (!isMountedRef.current) {
      return;
    }
    clearPendingLoadTimeout();
    loadTimeoutRef.current = setTimeout(() => {
      loadTimeoutRef.current = null;
      if (!isMountedRef.current) {
        return;
      }
      if (statusRef.current !== 'loading') {
        return;
      }
      setErrorMessage(PAYMENT_LOAD_TIMEOUT_MESSAGE);
      setPaymentStatus('error');
    }, PAYMENT_LOAD_TIMEOUT_MS);
  };

  const scheduleDelayedNavigation = (navigate: () => void) => {
    if (!isMountedRef.current) {
      return;
    }
    clearPendingNavigation();
    navigationTimeoutRef.current = setTimeout(() => {
      navigationTimeoutRef.current = null;
      if (isMountedRef.current) {
        navigate();
      }
    }, PAYMENT_SUCCESS_NAV_DELAY_MS);
  };

  const validatedParams = (() => {
    const result = PaymentGatewayParamsSchema.safeParse(params);
    if (!result.success) {
      return {
        data: null,
        error: result.error.issues[0]?.message || 'Invalid parameters',
        isValid: false,
      };
    }
    return { data: result.data, error: null, isValid: true };
  })();

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

  const beginWalletTopUpCompletion = () => {
    const currentStatus = statusRef.current;
    if (
      paymentCompletionStartedRef.current ||
      currentStatus === 'processing' ||
      currentStatus === 'success'
    ) {
      return;
    }

    if (!isWalletTopUpGateway(gateway) || !reference) {
      setPaymentStatus('error');
      setErrorMessage('Wallet top-up details are incomplete.');
      return;
    }

    paymentCompletionStartedRef.current = true;
    clearPendingLoadTimeout();
    setPaymentStatus('processing');

    void (async () => {
      try {
        await waitForWalletTopUpConfirmation({
          gateway,
          merchantId,
          merchantSlug,
          reference,
        });
        if (!isMountedRef.current) {
          return;
        }
        await queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
        if (!isMountedRef.current) {
          return;
        }
        setPaymentStatus('success');
        scheduleDelayedNavigation(() => {
          router.replace(returnTo || '/wallet');
        });
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        if (error instanceof WalletTopUpStillProcessingError) {
          paymentCompletionStartedRef.current = false;
          setPaymentStatus('error');
          setErrorMessage(error.message);
          return;
        }

        paymentCompletionStartedRef.current = false;
        setPaymentStatus('error');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Wallet top-up could not be confirmed.'
        );
      }
    })();
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
      beginWalletTopUpCompletion();
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

  const handleWebViewMessage = createPaymentGatewayMessageHandler({
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

  return {
    amount,
    authorizationUrl,
    errorMessage,
    gatewayName,
    // Alias retained for checkout back-button consumers; both paths confirm cancellation.
    handleBack: handleClose,
    handleClose,
    handleLoadEnd: () => {
      clearPendingLoadTimeout();
      setPaymentStatus((currentStatus) =>
        currentStatus === 'error' ||
        currentStatus === 'processing' ||
        currentStatus === 'success'
          ? currentStatus
          : 'ready'
      );
    },
    handleLoadStart: () => {
      const currentStatus = statusRef.current;
      if (
        currentStatus === 'error' ||
        currentStatus === 'processing' ||
        currentStatus === 'success'
      ) {
        return;
      }
      setErrorMessage(null);
      scheduleLoadTimeout();
      setPaymentStatus((currentStatus) =>
        currentStatus === 'error' ||
        currentStatus === 'processing' ||
        currentStatus === 'success'
          ? currentStatus
          : 'loading'
      );
    },
    handleNavigationChange: (navState: WebViewNavigation) => {
      if (
        statusRef.current === 'processing' ||
        statusRef.current === 'success'
      ) {
        return;
      }
      if (isPaymentCompletionRedirect(navState.url)) {
        beginPaymentCompletion();
        return;
      }
      if (isPaymentCancellationRedirect(navState.url)) {
        setPaymentStatus('error');
        setErrorMessage('Payment was cancelled.');
      }
    },
    handleRetry: () => {
      vtuConfirmationTokenRef.current += 1;
      paymentCompletionStartedRef.current = false;
      copiedGatewayTextRef.current = null;
      clearPendingNavigation();
      clearPendingLoadTimeout();
      setPaymentStatus('loading');
      setErrorMessage(null);
      webViewRef.current?.reload();
    },
    handleShouldStartLoadWithRequest: (request: { url: string }) => {
      if (
        (paymentKind === PAYMENT_KINDS.VTU ||
          paymentKind === PAYMENT_KINDS.WALLET) &&
        isPaymentCompletionRedirect(request.url)
      ) {
        beginPaymentCompletion();
        return false;
      }
      return true;
    },
    handleWebViewError: (syntheticEvent: WebViewErrorEvent) => {
      const { nativeEvent } = syntheticEvent;
      if (
        paymentCompletionStartedRef.current ||
        nativeEvent.url?.startsWith('about:')
      ) {
        return;
      }
      clearPendingLoadTimeout();
      setPaymentStatus('error');
      setErrorMessage(nativeEvent.description || 'Failed to load payment page');
    },
    handleWebViewMessage,
    paymentKind,
    status,
    toast,
    utilityType,
    validatedParams,
    webViewRef,
  };
}
