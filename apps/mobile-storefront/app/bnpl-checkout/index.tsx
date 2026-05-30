import Ionicons from '@react-native-vector-icons/ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { z } from 'zod';
import { BNPLCheckoutStatusView } from '@/components/bnpl-checkout/BNPLCheckoutStatusView';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { resolveApiBaseUrl } from '@/lib/api-url';
import {
  buildKlumpAuthorizationUrl,
  isAllowedBnplPopupUrl,
  normalizeBNPLRouteParams,
  type BNPLRouteParams,
} from '@/lib/bnpl-url';
import { useCartStore } from '@/stores/cart-store';

// 2026 Critical Fix: Zod schema for route parameter validation
const BNPLParamsSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  // Zod 4: Use message option instead of errorMap
  gateway: z.enum(['credpal', 'credit_direct', 'klump'] as const, {
    message: 'Invalid payment gateway',
  }),
  authorizationUrl: z.string().min(1).optional(),
  amount: z.string().regex(/^\d+$/, 'Amount must be a number').optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  merchantSlug: z.string().optional(),
  reference: z.string().optional(),
  trackingToken: z.string().optional(),
});

const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
const BNPL_LOAD_TIMEOUT_MS = 45_000;
const BNPL_LOAD_TIMEOUT_MESSAGE =
  'Payment page is taking longer than expected. Check your connection and try again.';
const BNPL_UNTRUSTED_POPUP_MESSAGE =
  'Payment provider opened an untrusted checkout window.';
type BNPLCheckoutStatus = 'loading' | 'ready' | 'success' | 'error';

type WebViewOpenWindowEventLike = {
  nativeEvent: {
    targetUrl?: string;
  };
};

export default function BNPLCheckoutScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  // 2026 Best Practice: Use Record type for route params to satisfy expo-router constraints
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

  // 2026 Critical Fix: Validate route params with Zod
  const validatedParams = (() => {
    const result = BNPLParamsSchema.safeParse(params);
    if (!result.success) {
      return {
        isValid: false,
        // Zod 4: Use .issues instead of .errors
        error: result.error.issues[0]?.message || 'Invalid parameters',
        data: null,
      };
    }
    return { isValid: true, error: null, data: result.data };
  })();

  const {
    orderId,
    gateway,
    authorizationUrl,
    amount,
    customerEmail,
    customerName,
    customerPhone,
    reference,
    trackingToken,
  } = validatedParams.data || {};

  useEffect(
    () => () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    },
    []
  );

  const clearPendingLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  const scheduleLoadTimeout = () => {
    clearPendingLoadTimeout();
    loadTimeoutRef.current = setTimeout(() => {
      loadTimeoutRef.current = null;
      if (statusRef.current !== 'loading') {
        return;
      }
      setErrorMessage(BNPL_LOAD_TIMEOUT_MESSAGE);
      setCheckoutStatus('error');
    }, BNPL_LOAD_TIMEOUT_MS);
  };

  // Construct the BNPL launcher URL
  // 2026 Critical Fix: Include merchant slug in path for correct multi-tenant routing
  // and as a query parameter for the order fetch API.
  const bnplUrl = (() => {
    if (!validatedParams.isValid || !orderId) return '';

    const slug =
      validatedParams.isValid && validatedParams.data
        ? validatedParams.data.merchantSlug || 'ogabassey'
        : 'ogabassey';
    const baseUrl = API_BASE_URL.endsWith('/')
      ? API_BASE_URL.slice(0, -1)
      : API_BASE_URL;

    if (gateway === 'klump') {
      return buildKlumpAuthorizationUrl({
        authorizationUrl,
        baseUrl,
        customerEmail,
        customerName,
        customerPhone,
        orderId,
        reference,
        slug,
        trackingToken,
      });
    }

    const query = new URLSearchParams({
      gateway: gateway || '',
      merchant_slug: slug,
      orderId,
    });

    if (customerEmail?.trim()) {
      query.set('email', customerEmail.trim());
    }
    if (customerName?.trim()) {
      query.set('customerName', customerName.trim());
    }
    if (customerPhone?.trim()) {
      query.set('customerPhone', customerPhone.trim());
    }
    if (trackingToken?.trim()) {
      query.set('token', trackingToken.trim());
    }

    // Pattern: [baseUrl]/[slug]/checkout/bnpl?orderId=[id]&gateway=[gateway]&merchant_slug=[slug]
    // If baseUrl already includes the merchant (custom domain), the path /slug /checkout still works
    // because Next.js handles the rewrite.
    return `${baseUrl}/${slug}/checkout/bnpl?${query.toString()}`;
  })();

  useEffect(() => {
    if (bnplUrl) {
      setCurrentUrl(bnplUrl);
    }
  }, [bnplUrl]);

  // 2026 Critical Fix: Show error state for invalid params
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

    // Check for success redirect
    if (url.includes('/order-success') || url.includes('success=true')) {
      clearPendingLoadTimeout();
      setCheckoutStatus('success');
      clearCart();

      // Extract reference from URL if present
      const urlParams = new URL(url);
      const reference = urlParams.searchParams.get('reference');

      // Navigate to order success screen
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
      const urlParams = new URL(url);
      setErrorMessage(
        urlParams.searchParams.get('error') ||
          'Payment failed. Please try again.'
      );
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

    if (!targetUrl || !isAllowedBnplPopupUrl(targetUrl, API_BASE_URL)) {
      clearPendingLoadTimeout();
      setCheckoutStatus('error');
      setErrorMessage(BNPL_UNTRUSTED_POPUP_MESSAGE);
      return;
    }

    setErrorMessage(null);
    scheduleLoadTimeout();
    setCheckoutStatus('loading');
    setCurrentUrl(targetUrl);
  };

  const gatewayName =
    gateway === 'credpal'
      ? 'CredPal'
      : gateway === 'credit_direct'
        ? 'Credit Direct'
        : 'Klump';

  // Inject JavaScript to capture BNPL callbacks
  const injectedJavaScript = `
    (function() {
      // Override console.log to capture BNPL events
      const originalLog = console.log;
      console.log = function(...args) {
        originalLog.apply(console, args);
        const message = args.join(' ');
        if (message.includes('Credit Direct') || message.includes('CredPal') || message.includes('Klump')) {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'bnpl_log',
            message: message
          }));
        }
      };

      // Listen for success/error events
      window.addEventListener('message', function(event) {
        if (event.data && typeof event.data === 'object') {
          window.ReactNativeWebView?.postMessage(JSON.stringify(event.data));
        }
      });

      // Intercept page navigation
      const originalPushState = history.pushState;
      history.pushState = function() {
        originalPushState.apply(history, arguments);
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'navigation',
          url: window.location.href
        }));
      };
    })();
    true;
  `;

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

      {/* Loading overlay */}
      {status === 'loading' && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="large" color={BRAND.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Launching {gatewayName}...
            </Text>
            <Text
              style={[styles.loadingSubtext, { color: colors.textSecondary }]}
            >
              Please wait while we prepare your installment checkout
            </Text>
          </View>
        </View>
      )}

      {/* Security badge */}
      <View
        style={[
          styles.securityBadge,
          { backgroundColor: `${BRAND.primary}10` },
        ]}
      >
        <Ionicons name="shield-checkmark" size={16} color={BRAND.primary} />
        <Text style={[styles.securityText, { color: BRAND.primary }]}>
          Secure {gatewayName} Checkout
        </Text>
      </View>

      {/* BNPL WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl || bnplUrl }}
        style={styles.webView}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onNavigationStateChange={handleNavigationChange}
        onMessage={handleWebViewMessage}
        onOpenWindow={handleOpenWindow}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        javaScriptCanOpenWindowsAutomatically={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          clearPendingLoadTimeout();
          setCheckoutStatus('error');
          setErrorMessage(
            nativeEvent.description || 'Failed to load payment page'
          );
        }}
        renderLoading={() => (
          <View style={styles.webViewLoading}>
            <ActivityIndicator size="large" color={BRAND.primary} />
          </View>
        )}
      />

      {/* Amount display */}
      <View
        style={[
          styles.amountBanner,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
          Total Amount
        </Text>
        <Text style={[styles.amountValue, { color: BRAND.primary }]}>
          ₦{Number(amount || '0').toLocaleString()}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  securityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 100,
  },
  loadingCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    maxWidth: 300,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 13,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  amountBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderTopWidth: 1,
  },
  amountLabel: {
    fontSize: 14,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '700',
  },
});
