import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { isAllowedBnplPopupUrl } from '@/lib/bnpl-url';
import { useCartStore } from '@/stores/cart-store';
import {
  type BNPLShouldStartLoadRequest,
  type WebViewOpenWindowEventLike,
} from './BNPLCheckoutWebView';
import {
  BNPL_UNTRUSTED_POPUP_MESSAGE,
  buildBNPLCheckoutUrl,
  extractErrorFromUrl,
  extractReferenceFromUrl,
  getBNPLGatewayName,
  parseBNPLParams,
  resolveBNPLDocumentNavigation,
  sanitizeBNPLDocumentUrl,
} from './bnpl-checkout.helpers';
import { createBNPLLoadTimers } from './bnpl-checkout-timers';

type BNPLCheckoutStatus = 'loading' | 'ready' | 'success' | 'error';
type BNPLCheckoutParams = Parameters<typeof parseBNPLParams>[0];

type BNPLCheckoutControllerInput = {
  apiBaseUrl: string;
  params: BNPLCheckoutParams;
};

export function useBNPLCheckoutController({
  apiBaseUrl,
  params,
}: BNPLCheckoutControllerInput) {
  const webViewRef = useRef<WebView>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCart = useCartStore((state) => state.clearCart);

  const [status, setStatusState] = useState<BNPLCheckoutStatus>('loading');
  const [currentUrl, setCurrentUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const statusRef = useRef<BNPLCheckoutStatus>('loading');

  const setCheckoutStatus = (
    nextStatus:
      | BNPLCheckoutStatus
      | ((currentStatus: BNPLCheckoutStatus) => BNPLCheckoutStatus)
  ) => {
    const resolvedStatus =
      typeof nextStatus === 'function'
        ? nextStatus(statusRef.current)
        : nextStatus;
    statusRef.current = resolvedStatus;
    setStatusState(resolvedStatus);
  };

  const validatedParams = parseBNPLParams(params);
  const { orderId, gateway, amount, trackingToken } =
    validatedParams.data || {};

  const { clearPendingLoadTimeout, scheduleLoadTimeout } = createBNPLLoadTimers(
    {
      loadTimeoutRef,
      setCheckoutStatus,
      setErrorMessage,
      statusRef,
    }
  );

  useEffect(() => () => clearPendingLoadTimeout(), [clearPendingLoadTimeout]);

  const bnplUrl = buildBNPLCheckoutUrl({
    apiBaseUrl,
    params: validatedParams,
  });

  useEffect(() => {
    if (bnplUrl) {
      setCurrentUrl(bnplUrl);
    }
  }, [bnplUrl]);

  const navigateToSuccess = (reference?: string) => {
    setTimeout(() => {
      router.replace({
        pathname: '/order-success',
        params: {
          orderId,
          reference: reference || undefined,
          paymentMethod: gateway,
          ...(trackingToken && { trackingToken }),
        },
      });
    }, 1000);
  };

  const markSuccess = (reference?: string) => {
    clearPendingLoadTimeout();
    setCheckoutStatus('success');
    clearCart();
    navigateToSuccess(reference);
  };

  const handleNavigationChange = (navState: WebViewNavigation) => {
    const { url } = navState;

    if (url.includes('/order-success') || url.includes('success=true')) {
      markSuccess(extractReferenceFromUrl(url) || undefined);
    }

    if (url.includes('/checkout') && url.includes('cancelled=true')) {
      clearPendingLoadTimeout();
      setCheckoutStatus('error');
      setErrorMessage('Payment was cancelled.');
    }

    if (url.includes('error=') || url.includes('/checkout?error')) {
      clearPendingLoadTimeout();
      setCheckoutStatus('error');
      setErrorMessage(extractErrorFromUrl(url) || 'Payment failed. Please try again.');
    }
  };

  const handleClose = () => {
    Alert.alert(
      'Cancel Payment?',
      'Are you sure you want to cancel this payment?',
      [
        { text: 'Continue Payment', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'navigation' && typeof data.url === 'string') {
        handleNavigationChange({ url: data.url } as WebViewNavigation);
      } else if (data.type === 'bnpl_success') {
        markSuccess(data.reference);
      } else if (data.type === 'bnpl_error') {
        clearPendingLoadTimeout();
        setCheckoutStatus('error');
        setErrorMessage(data.message || 'Payment failed.');
      } else if (data.type === 'bnpl_close') {
        handleClose();
      }
    } catch {
      // Ignore non-JSON messages
    }
  };

  const handleRetry = () => {
    clearPendingLoadTimeout();
    setCheckoutStatus('loading');
    setErrorMessage(null);
    setCurrentUrl(bnplUrl);
    if ((currentUrl || bnplUrl) === bnplUrl) {
      webViewRef.current?.reload();
    }
  };

  const handleLoadStart = () => {
    if (statusRef.current === 'error' || statusRef.current === 'success') {
      return;
    }
    setErrorMessage(null);
    scheduleLoadTimeout();
    setCheckoutStatus('loading');
  };

  const handleLoadEnd = () => {
    clearPendingLoadTimeout();
    setCheckoutStatus((currentStatus) =>
      currentStatus === 'error' || currentStatus === 'success'
        ? currentStatus
        : 'ready'
    );
  };

  const handleLoadError = (description?: string) => {
    clearPendingLoadTimeout();
    setCheckoutStatus('error');
    setErrorMessage(description || 'Failed to load payment page');
  };

  const handleOpenWindow = (event: WebViewOpenWindowEventLike) => {
    const targetUrl = event.nativeEvent.targetUrl;
    const sanitizedTargetUrl = targetUrl
      ? sanitizeBNPLDocumentUrl(targetUrl)
      : '';

    if (
      !sanitizedTargetUrl ||
      sanitizedTargetUrl === 'about:blank' ||
      sanitizedTargetUrl.startsWith('about:blank#')
    ) {
      return;
    }

    if (!isAllowedBnplPopupUrl(sanitizedTargetUrl, apiBaseUrl)) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[BNPLCheckout] Ignored untrusted auxiliary window', {
          targetUrl: sanitizedTargetUrl,
        });
      }
      return;
    }

    setErrorMessage(null);
    scheduleLoadTimeout();
    setCheckoutStatus('loading');
    setCurrentUrl(sanitizedTargetUrl);
  };

  const handleShouldStartLoadWithRequest = (
    request: BNPLShouldStartLoadRequest
  ) => {
    const decision = resolveBNPLDocumentNavigation({
      apiBaseUrl,
      currentDocumentUrl: currentUrl || bnplUrl,
      isTopFrame: request.isTopFrame,
      requestUrl: request.url,
    });
    if (decision.shouldStart) {
      return true;
    }

    if (decision.reason === 'untrusted') {
      clearPendingLoadTimeout();
      setCheckoutStatus('error');
      setErrorMessage(BNPL_UNTRUSTED_POPUP_MESSAGE);
      return false;
    }

    setErrorMessage(null);
    scheduleLoadTimeout();
    setCheckoutStatus('loading');
    setCurrentUrl(decision.nextUrl);
    return false;
  };

  return {
    amount,
    bnplUrl,
    currentUrl,
    errorMessage,
    gatewayName: getBNPLGatewayName(gateway),
    handleClose,
    handleLoadEnd,
    handleLoadError,
    handleLoadStart,
    handleNavigationChange,
    handleOpenWindow,
    handleRetry,
    handleShouldStartLoadWithRequest,
    handleWebViewMessage,
    status,
    validatedParams,
    webViewRef,
  };
}
