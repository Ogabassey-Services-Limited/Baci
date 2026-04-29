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
  isPaymentCancellationRedirect,
  isPaymentCompletionRedirect,
  PAYMENT_GATEWAY_LABELS,
} from './payment-gateway.helpers';

type WebViewErrorEvent = Parameters<
  NonNullable<ComponentProps<typeof WebView>['onError']>
>[0];

const PAYMENT_SUCCESS_NAV_DELAY_MS = 1500;

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
  const gatewayName = PAYMENT_GATEWAY_LABELS[gateway || ''] || 'Payment';

  const routeToUtilityResult = ({
    resultAmount,
    resultCustomerIdentifier,
    resultReference,
    resultStatus,
    resultVoucherPin,
  }: {
    resultAmount?: number;
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
        ...(resultVoucherPin && { voucherPin: resultVoucherPin }),
      },
    });
  };

  const handleVtuConfirmation = async () => {
    if (!utilityType || !gateway || gateway === 'juicyway') {
      setStatus('error');
      setErrorMessage('Utility payment could not be confirmed.');
      return;
    }

    try {
      if (!reference) {
        throw new Error('Payment reference is missing.');
      }

      const result = await waitForVtuConfirmation({
        gateway,
        reference,
      });
      setStatus('success');
      scheduleDelayedNavigation(() => {
        router.replace({
          pathname: '/utilities/[type]',
          params: {
            amount: String(result.amount ?? amount ?? 0),
            paymentStatus: 'successful',
            reference: result.reference,
            type: utilityType,
            ...((result.customerIdentifier || customerIdentifier) && {
              customerIdentifier:
                result.customerIdentifier || customerIdentifier,
            }),
            ...(result.cashback && {
              cashbackAmount: String(result.cashback.amount),
              cashbackNewBalance: String(result.cashback.newBalance),
            }),
            ...(result.voucherPin && { voucherPin: result.voucherPin }),
          },
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
    if (paymentKind === 'vtu') {
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
          orderId,
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
    clearCart,
    copiedGatewayTextRef,
    copyGatewayText,
    gateway,
    orderId,
    orderNumber,
    reference,
    markPaymentCompletionStarted: () => {
      paymentCompletionStartedRef.current = true;
    },
    setSuccessStatus: () => setStatus('success'),
  });

  return {
    amount,
    authorizationUrl,
    errorMessage,
    gatewayName,
    handleBack: () => router.back(),
    handleClose: () => {
      Alert.alert(
        'Cancel Payment?',
        paymentKind === 'vtu'
          ? 'If you leave now, this utility payment may remain incomplete until you retry it.'
          : 'Your order has been created. If you leave, you can complete payment later from your orders page.',
        [
          { text: 'Continue Payment', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => router.back() },
        ]
      );
    },
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
      if (paymentKind === 'vtu' && isPaymentCompletionRedirect(request.url)) {
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
