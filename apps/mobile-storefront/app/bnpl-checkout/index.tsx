/**
 * BNPL Checkout Screen
 * Handles Buy Now Pay Later checkout via WebView
 * Supports CredPal and Credit Direct payment gateways
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
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
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { resolveApiBaseUrl } from '@/lib/api-url';
import { useCartStore } from '@/stores/cart-store';

// 2026 Critical Fix: Zod schema for route parameter validation
const BNPLParamsSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  // Zod 4: Use message option instead of errorMap
  gateway: z.enum(['credpal', 'credit_direct'] as const, {
    message: 'Invalid payment gateway',
  }),
  amount: z.string().regex(/^\d+$/, 'Amount must be a number').optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  merchantSlug: z.string().optional(),
});

const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);

export default function BNPLCheckoutScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  // 2026 Best Practice: Use Record type for route params to satisfy expo-router constraints
  const params = useLocalSearchParams<Record<string, string>>();
  const webViewRef = useRef<WebView>(null);
  const clearCart = useCartStore((state) => state.clearCart);

  const [status, setStatus] = useState<
    'loading' | 'ready' | 'processing' | 'success' | 'error'
  >('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const { orderId, gateway, amount } = validatedParams.data || {};

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

    // Pattern: [baseUrl]/[slug]/checkout/bnpl?orderId=[id]&gateway=[gateway]&merchant_slug=[slug]
    // If baseUrl already includes the merchant (custom domain), the path /slug /checkout still works
    // because Next.js handles the rewrite.
    return `${baseUrl}/${slug}/checkout/bnpl?orderId=${orderId}&gateway=${gateway}&merchant_slug=${slug}`;
  })();

  // 2026 Critical Fix: Show error state for invalid params
  if (!validatedParams.isValid) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={BRAND.primary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Invalid Checkout
          </Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {validatedParams.error}
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: BRAND.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.retryText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleNavigationChange = (navState: WebViewNavigation) => {
    const { url } = navState;

    // Check for success redirect
    if (url.includes('/order-success') || url.includes('success=true')) {
      setStatus('success');
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
          },
        });
      }, 1000);
    }

    // Check for cancellation
    if (url.includes('/checkout') && url.includes('cancelled=true')) {
      setStatus('error');
      setErrorMessage('Payment was cancelled.');
    }

    // Check for error
    if (url.includes('error=') || url.includes('/checkout?error')) {
      setStatus('error');
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

      if (data.type === 'bnpl_success') {
        setStatus('success');
        clearCart();
        setTimeout(() => {
          router.replace({
            pathname: '/order-success',
            params: {
              orderId,
              reference: data.reference,
              paymentMethod: gateway,
            },
          });
        }, 1000);
      } else if (data.type === 'bnpl_error') {
        setStatus('error');
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
    setStatus('loading');
    setErrorMessage(null);
    webViewRef.current?.reload();
  };

  const gatewayName = gateway === 'credpal' ? 'CredPal' : 'Credit Direct';

  // Inject JavaScript to capture BNPL callbacks
  const injectedJavaScript = `
    (function() {
      // Override console.log to capture BNPL events
      const originalLog = console.log;
      console.log = function(...args) {
        originalLog.apply(console, args);
        const message = args.join(' ');
        if (message.includes('Credit Direct') || message.includes('CredPal')) {
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
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.statusContainer}>
          <View style={[styles.statusIcon, { backgroundColor: '#DEF7EC' }]}>
            <Ionicons name="checkmark-circle" size={48} color="#059669" />
          </View>
          <Text style={[styles.statusTitle, { color: colors.text }]}>
            Payment Successful!
          </Text>
          <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
            Your {gatewayName} payment has been approved. Redirecting to order
            confirmation...
          </Text>
          <ActivityIndicator
            size="small"
            color={BRAND.primary}
            style={styles.statusLoader}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Stack.Screen
          options={{
            title: gatewayName,
            headerLeft: () => (
              <Pressable onPress={() => router.back()}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            ),
          }}
        />
        <View style={styles.statusContainer}>
          <View style={[styles.statusIcon, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="alert-circle" size={48} color="#DC2626" />
          </View>
          <Text style={[styles.statusTitle, { color: colors.text }]}>
            Payment Failed
          </Text>
          <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
            {errorMessage}
          </Text>
          <View style={styles.errorActions}>
            <Pressable
              style={[styles.retryButton, { backgroundColor: BRAND.primary }]}
              onPress={handleRetry}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
            <Pressable
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => router.back()}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                Go Back
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
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
        source={{ uri: bnplUrl }}
        style={styles.webView}
        onLoadStart={() => setStatus('loading')}
        onLoadEnd={() => setStatus('ready')}
        onNavigationStateChange={handleNavigationChange}
        onMessage={handleWebViewMessage}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setStatus('error');
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
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
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
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  statusLoader: {
    marginTop: SPACING.lg,
  },
  errorActions: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
    width: '100%',
  },
  retryButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  // 2026 Critical Fix: Styles for invalid params error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
