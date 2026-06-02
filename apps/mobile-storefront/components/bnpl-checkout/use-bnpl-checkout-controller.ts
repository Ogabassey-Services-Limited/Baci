import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { WebView, WebViewNavigation } from 'react-native-webview';
import { isAllowedBnplPopupUrl, isTrustedBnplReturnUrl } from '@/lib/bnpl-url';
import { useCartStore } from '@/stores/cart-store';
import type {
  BNPLShouldStartLoadRequest,
  BNPLWebViewHttpErrorEvent,
  BNPLWebViewLoadError,
  WebViewOpenWindowEventLike,
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
import {
  createBNPLWebViewMessageHandler,
  logBNPLCheckoutDebug,
} from './bnpl-checkout-message-handler';
import { createBNPLLoadTimers } from './bnpl-checkout-timers';

type BNPLCheckoutParams = Parameters<typeof parseBNPLParams>[0];
export type BNPLCheckoutStatus = 'loading' | 'ready' | 'success' | 'error';

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
  const {
    orderId,
    gateway,
    amount,
    trackingToken,
    merchantSlug,
    merchantDomain,
  } = validatedParams.data || {};

  const { clearPendingLoadTimeout, scheduleLoadTimeout } = createBNPLLoadTimers(
    {
      loadTimeoutRef,
      setCheckoutStatus,
      setErrorMessage,
      statusRef,
    }
  );

  useEffect(
    () => () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    },
    []
  );

  const bnplUrl = buildBNPLCheckoutUrl({
    apiBaseUrl,
    params: validatedParams,
  });

  useEffect(() => {
    if (bnplUrl) {
      setCurrentUrl(bnplUrl);
    }
  }, [bnplUrl]);

  const replaceWithOrderSuccess = (reference?: string | null) => {
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

  const handleNavigationUrl = (url: string) => {
    if (url.includes('/order-success') || url.includes('success=true')) {
      clearPendingLoadTimeout();
      setCheckoutStatus('success');
      clearCart();
      replaceWithOrderSuccess(extractReferenceFromUrl(url));
    }

    if (url.includes('/checkout') && url.includes('cancelled=true')) {
      clearPendingLoadTimeout();
      setCheckoutStatus('error');
      setErrorMessage('Payment was cancelled.');
    }

    if (url.includes('error=') || url.includes('/checkout?error')) {
      clearPendingLoadTimeout();
      setCheckoutStatus('error');
      setErrorMessage(
        extractErrorFromUrl(url) || 'Payment failed. Please try again.'
      );
    }
  };

  const handleNavigationChange = (navState: WebViewNavigation) => {
    handleNavigationUrl(navState.url);
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

  const handleWebViewMessage = createBNPLWebViewMessageHandler({
    onNavigationMessage: (url) => {
      if (
        !isTrustedBnplReturnUrl(url, apiBaseUrl, merchantSlug, merchantDomain)
      ) {
        logBNPLCheckoutDebug('ignored untrusted navigation message', {
          merchantDomain,
          merchantSlug,
          url,
        });
        return;
      }

      handleNavigationUrl(url);
    },
  });

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

    if (
      !isAllowedBnplPopupUrl(
        sanitizedTargetUrl,
        apiBaseUrl,
        merchantSlug,
        merchantDomain
      )
    ) {
      clearPendingLoadTimeout();
      setCheckoutStatus('error');
      setErrorMessage(BNPL_UNTRUSTED_POPUP_MESSAGE);
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
    const currentDocumentUrl = currentUrl || bnplUrl;
    const decision = resolveBNPLDocumentNavigation({
      apiBaseUrl,
      currentDocumentUrl,
      isTopFrame: request.isTopFrame,
      requestUrl: request.url,
      merchantSlug,
      merchantDomain,
    });
    logBNPLCheckoutDebug('document navigation decision', {
      currentDocumentUrl,
      decision,
      isTopFrame: request.isTopFrame,
      mainDocumentURL: request.mainDocumentURL,
      merchantSlug,
      merchantDomain,
      navigationType: request.navigationType,
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

  const handleWebViewError = (error: BNPLWebViewLoadError) => {
    logBNPLCheckoutDebug('native load error', error);
    clearPendingLoadTimeout();
    setCheckoutStatus('error');
    setErrorMessage(error.description || 'Failed to load payment page');
  };

  const handleWebViewHttpError = (event: BNPLWebViewHttpErrorEvent) => {
    const { description, statusCode, url } = event.nativeEvent;
    logBNPLCheckoutDebug('http error', { description, statusCode, url });
  };

  return {
    amount,
    bnplUrl,
    currentUrl,
    errorMessage,
    gatewayName: getBNPLGatewayName(gateway),
    handleClose,
    handleLoadEnd,
    handleLoadStart,
    handleNavigationChange,
    handleOpenWindow,
    handleRetry,
    handleShouldStartLoadWithRequest,
    handleWebViewError,
    handleWebViewHttpError,
    handleWebViewMessage,
    status,
    validatedParams,
    webViewRef,
  };
}
