import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { WebView, WebViewNavigation } from 'react-native-webview';
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
  getBNPLGatewayName,
  parseBNPLParams,
  resolveBNPLDocumentNavigation,
} from './bnpl-checkout.helpers';
import {
  resolveBNPLNavigationUrlEffect,
  resolveBNPLPopupTargetAction,
  shouldHandleBNPLNavigationMessage,
} from './bnpl-checkout-controller-actions';
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
    const effect = resolveBNPLNavigationUrlEffect(url);
    if (!effect) {
      return;
    }

    clearPendingLoadTimeout();
    setCheckoutStatus(effect.status);
    if (effect.status === 'success') {
      clearCart();
      replaceWithOrderSuccess(effect.reference);
      return;
    }
    setErrorMessage(effect.errorMessage);
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
        !shouldHandleBNPLNavigationMessage({
          apiBaseUrl,
          merchantDomain,
          merchantSlug,
          url,
        })
      ) {
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
    const action = resolveBNPLPopupTargetAction({
      apiBaseUrl,
      merchantDomain,
      merchantSlug,
      targetUrl: event.nativeEvent.targetUrl,
    });
    if (action.type === 'ignore') {
      return;
    }

    if (action.type === 'untrusted') {
      clearPendingLoadTimeout();
      setCheckoutStatus('error');
      setErrorMessage(BNPL_UNTRUSTED_POPUP_MESSAGE);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[BNPLCheckout] Ignored untrusted auxiliary window', {
          targetUrl: action.targetUrl,
        });
      }
      return;
    }

    setErrorMessage(null);
    scheduleLoadTimeout();
    setCheckoutStatus('loading');
    setCurrentUrl(action.targetUrl);
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
