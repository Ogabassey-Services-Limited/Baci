import Ionicons from '@react-native-vector-icons/ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { BNPLCheckoutStatusView } from '@/components/bnpl-checkout/BNPLCheckoutStatusView';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { resolveApiBaseUrl } from '@/lib/api-url';
import {
  isAllowedBnplPopupUrl,
  normalizeBNPLRouteParams,
  type BNPLRouteParams,
} from '@/lib/bnpl-url';
import { useCartStore } from '@/stores/cart-store';
import { bnplCheckoutScreenStyles as styles } from './BNPLCheckoutScreen.styles';
import {
  type BNPLShouldStartLoadRequest,
  BNPLCheckoutWebView,
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

const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
type BNPLCheckoutStatus = 'loading' | 'ready' | 'success' | 'error';

export function BNPLCheckoutScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const rawParams = useLocalSearchParams<BNPLRouteParams>();
  const params = normalizeBNPLRouteParams(rawParams);
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
    apiBaseUrl: API_BASE_URL,
    params: validatedParams,
  });

  useEffect(() => {
    if (bnplUrl) {
      setCurrentUrl(bnplUrl);
    }
  }, [bnplUrl]);

  if (!validatedParams.isValid) {
    return (
      <BNPLCheckoutStatusView
        colors={colors}
        message={validatedParams.error}
        onBack={() => router.back()}
        variant="invalid"
      />
    );
  }

  const handleNavigationChange = (navState: WebViewNavigation) => {
    const { url } = navState;

    if (url.includes('/order-success') || url.includes('success=true')) {
      clearPendingLoadTimeout();
      setCheckoutStatus('success');
      clearCart();

      const reference = extractReferenceFromUrl(url);

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
    }

    // Check for cancellation
    if (url.includes('/checkout') && url.includes('cancelled=true')) {
      clearPendingLoadTimeout();
      setCheckoutStatus('error');
      setErrorMessage('Payment was cancelled.');
    }

    // Check for error
    if (url.includes('error=') || url.includes('/checkout?error')) {
      clearPendingLoadTimeout();
      setCheckoutStatus('error');
      const errorParam = extractErrorFromUrl(url);
      setErrorMessage(errorParam || 'Payment failed. Please try again.');
    }
  };

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'navigation' && typeof data.url === 'string') {
        handleNavigationChange({ url: data.url } as WebViewNavigation);
      } else if (data.type === 'bnpl_success') {
        clearPendingLoadTimeout();
        setCheckoutStatus('success');
        clearCart();
        setTimeout(() => {
          router.replace({
            pathname: '/order-success',
            params: {
              orderId,
              reference: data.reference,
              paymentMethod: gateway,
              ...(trackingToken && { trackingToken }),
            },
          });
        }, 1000);
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
      !isAllowedBnplPopupUrl(sanitizedTargetUrl, API_BASE_URL)
    ) {
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
      apiBaseUrl: API_BASE_URL,
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

  const gatewayName = getBNPLGatewayName(gateway);

  if (status === 'success') {
    return (
      <BNPLCheckoutStatusView
        colors={colors}
        gatewayName={gatewayName}
        variant="success"
      />
    );
  }

  if (status === 'error') {
    return (
      <BNPLCheckoutStatusView
        colors={colors}
        gatewayName={gatewayName}
        message={errorMessage}
        onBack={() => router.back()}
        onRetry={handleRetry}
        variant="error"
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <Stack.Screen
        options={{
          title: gatewayName,
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <BNPLCheckoutWebView
        amount={amount}
        bnplUrl={bnplUrl}
        colors={colors}
        currentUrl={currentUrl}
        gatewayName={gatewayName}
        onError={(description) => {
          clearPendingLoadTimeout();
          setCheckoutStatus('error');
          setErrorMessage(description || 'Failed to load payment page');
        }}
        onLoadEnd={handleLoadEnd}
        onLoadStart={handleLoadStart}
        onMessage={handleWebViewMessage}
        onNavigationStateChange={handleNavigationChange}
        onOpenWindow={handleOpenWindow}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        status={status}
        webViewRef={webViewRef}
      />
    </SafeAreaView>
  );
}
