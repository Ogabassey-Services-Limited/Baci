import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { WebView, WebViewNavigation } from 'react-native-webview';
import { useToast } from '@/components/ui/Toast';
import { setClipboardString } from '@/lib/clipboard';
import {
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import { PaymentGatewayParamsSchema } from '@/schemas/payment-gateway';
import { useCartStore } from '@/stores/cart-store';
import { createPaymentGatewayMessageHandler } from './create-payment-gateway-message-handler';
import {
  isPaymentGateway,
  isPaymentCancellationRedirect,
  isPaymentCompletionRedirect,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_KINDS,
} from './payment-gateway.helpers';

type WebViewErrorEvent = Parameters<
  NonNullable<ComponentProps<typeof WebView>['onError']>
>[0];

const PAYMENT_SUCCESS_NAV_DELAY_MS = 1500;
const JUICYWAY_GATEWAY = 'juicyway';

export function usePaymentGatewayController() {
  const params = useLocalSearchParams<Record<string, string>>();
  const webViewRef = useRef<WebView>(null);
  const copiedGatewayTextRef = useRef<string | null>(null);
  const paymentCompletionStartedRef = useRef(false);
  const isMountedRef = useRef(true);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const clearCart = useCartStore((state) => state.clearCart);
  const toast = useToast();
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'processing' | 'success' | 'error'
  >('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(
    () => () => {
      isMountedRef.current = false;
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    },
    []
  );

  const scheduleDelayedNavigation = (navigate: () => void) => {
    if (!isMountedRef.current) {
      return;
    }
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
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
    orderId,
    orderNumber,
    paymentKind,
    reference,
    utilityType,
  } = validatedParams.data || {};
  const gatewayName =
    gateway && isPaymentGateway(gateway)
      ? PAYMENT_GATEWAY_LABELS[gateway]
      : 'Payment';

  const routeToUtilityResult = ({
    resultAmount,
    resultCashback,
    resultCustomerIdentifier,
    resultReference,
    resultStatus,
    resultVoucherPin,
  }: {
    resultAmount?: number;
    resultCashback?: {
      amount: number;
      newBalance: number;
    };
    resultCustomerIdentifier?: string;
    resultReference: string;
    resultStatus: 'processing' | 'successful';
    resultVoucherPin?: string;
  }) => {
    if (!utilityType) {
      return;
    }

    router.replace({
      pathname: '/utilities/[type]',
      params: {
        amount: String(resultAmount ?? amount ?? 0),
        paymentStatus: resultStatus,
        reference: resultReference,
        type: utilityType,
        ...((resultCustomerIdentifier || customerIdentifier) && {
          customerIdentifier: resultCustomerIdentifier || customerIdentifier,
        }),
        ...(resultCashback && {
          cashbackAmount: String(resultCashback.amount),
          cashbackNewBalance: String(resultCashback.newBalance),
        }),
        ...(resultVoucherPin && { voucherPin: resultVoucherPin }),
      },
    });
  };

  const handleVtuConfirmation = async () => {
    if (!utilityType || !gateway) {
      setStatus('error');
      setErrorMessage('Utility payment could not be confirmed.');
      return;
    }

    try {
      if (!reference) {
        throw new Error('Payment reference is missing.');
      }

      if (gateway === JUICYWAY_GATEWAY) {
        setStatus('success');
        scheduleDelayedNavigation(() => {
          routeToUtilityResult({
            resultAmount: amount,
            resultCustomerIdentifier: customerIdentifier,
            resultReference: reference,
            resultStatus: 'successful',
          });
        });
        return;
      }

      const result = await waitForVtuConfirmation({
        gateway,
        reference,
      });
      setStatus('success');
      scheduleDelayedNavigation(() => {
        routeToUtilityResult({
          resultAmount: result.amount,
          resultCashback: result.cashback,
          resultCustomerIdentifier: result.customerIdentifier,
          resultReference: result.reference,
          resultStatus: 'successful',
          resultVoucherPin: result.voucherPin,
        });
      });
    } catch (error) {
      if (error instanceof VtuPaymentStillProcessingError) {
        setStatus('processing');
        routeToUtilityResult({
          resultAmount: error.amount,
          resultCustomerIdentifier: error.customerIdentifier,
          resultReference: error.reference,
          resultStatus: 'processing',
        });
        return;
      }

      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Payment confirmation failed.'
      );
    }
  };

  const beginPaymentCompletion = () => {
    if (
      paymentCompletionStartedRef.current ||
      status === 'processing' ||
      status === 'success'
    ) {
      return;
    }

    paymentCompletionStartedRef.current = true;
    if (paymentKind === PAYMENT_KINDS.VTU) {
      setStatus('processing');
      void handleVtuConfirmation();
      return;
    }

    setStatus('success');
    clearCart();
    scheduleDelayedNavigation(() => {
      router.replace({
        pathname: '/order-success',
        params: {
          orderId: orderId || '',
          orderNumber: orderNumber || '',
          paymentMethod: gateway,
          reference: reference || '',
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
    copiedGatewayTextRef,
    copyGatewayText,
    customerIdentifier,
    gateway,
    orderId,
    orderNumber,
    paymentKind,
    reference,
    utilityType,
    markPaymentCompletionStarted: () => {
      paymentCompletionStartedRef.current = true;
    },
    scheduleDelayedNavigation,
    setSuccessStatus: () => setStatus('success'),
  });

  const handleClose = () => {
    Alert.alert(
      'Cancel Payment?',
      paymentKind === PAYMENT_KINDS.VTU
        ? 'If you leave now, this utility payment may remain incomplete until you retry it.'
        : 'Your order has been created. If you leave, you can complete payment later from your orders page.',
      [
        { text: 'Continue Payment', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  return {
    amount,
    authorizationUrl,
    errorMessage,
    gatewayName,
    // Alias retained for checkout back-button consumers; both paths confirm cancellation.
    handleBack: handleClose,
    handleClose,
    handleLoadEnd: () =>
      setStatus((currentStatus) =>
        currentStatus === 'error' ||
        currentStatus === 'processing' ||
        currentStatus === 'success'
          ? currentStatus
          : 'ready'
      ),
    handleLoadStart: () =>
      setStatus((currentStatus) =>
        currentStatus === 'error' ||
        currentStatus === 'processing' ||
        currentStatus === 'success'
          ? currentStatus
          : 'loading'
      ),
    handleNavigationChange: (navState: WebViewNavigation) => {
      if (status === 'processing' || status === 'success') {
        return;
      }
      if (isPaymentCompletionRedirect(navState.url)) {
        beginPaymentCompletion();
        return;
      }
      if (isPaymentCancellationRedirect(navState.url)) {
        setStatus('error');
        setErrorMessage('Payment was cancelled.');
      }
    },
    handleRetry: () => {
      paymentCompletionStartedRef.current = false;
      copiedGatewayTextRef.current = null;
      setStatus('loading');
      setErrorMessage(null);
      webViewRef.current?.reload();
    },
    handleShouldStartLoadWithRequest: (request: { url: string }) => {
      if (
        paymentKind === PAYMENT_KINDS.VTU &&
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
      setStatus('error');
      setErrorMessage(nativeEvent.description || 'Failed to load payment page');
    },
    handleWebViewMessage,
    paymentKind,
    status,
    toast,
    validatedParams,
    webViewRef,
  };
}
