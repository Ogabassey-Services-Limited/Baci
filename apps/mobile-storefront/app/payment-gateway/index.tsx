/**
 * Payment Gateway WebView Screen
 * Handles card payment checkout via Paystack, Korapay, and Juicyway
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
import { waitForVtuConfirmation } from '@/lib/vtu-checkout';
import { useCartStore } from '@/stores/cart-store';

const PaymentGatewayParamsSchema = z.object({
  orderId: z.string().optional(),
  orderNumber: z.string().optional(),
  gateway: z.enum(['paystack', 'korapay', 'juicyway'] as const, {
    message: 'Invalid payment gateway',
  }),
  authorizationUrl: z.string().url('Invalid authorization URL'),
  reference: z.string().min(1, 'Reference is required'),
  amount: z.string().optional(),
  paymentKind: z.enum(['order', 'vtu']).default('order'),
  utilityType: z.enum(['airtime', 'data', 'tv', 'power', 'gaming']).optional(),
  customerIdentifier: z.string().optional(),
});

const GATEWAY_LABELS: Record<string, string> = {
  paystack: 'Paystack',
  korapay: 'Korapay',
  juicyway: 'Juicyway',
};

export default function PaymentGatewayScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const params = useLocalSearchParams<Record<string, string>>();
  const webViewRef = useRef<WebView>(null);
  const clearCart = useCartStore((state) => state.clearCart);

  const [status, setStatus] = useState<
    'loading' | 'ready' | 'processing' | 'success' | 'error'
  >('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validatedParams = (() => {
    const result = PaymentGatewayParamsSchema.safeParse(params);
    if (!result.success) {
      return {
        isValid: false,
        error: result.error.issues[0]?.message || 'Invalid parameters',
        data: null,
      };
    }
    return { isValid: true, error: null, data: result.data };
  })();

  const {
    orderId,
    orderNumber,
    gateway,
    authorizationUrl,
    reference,
    amount,
    paymentKind,
    utilityType,
    customerIdentifier,
  } = validatedParams.data || {};

  const gatewayName = GATEWAY_LABELS[gateway || ''] || 'Payment';

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
            style={[styles.actionButton, { backgroundColor: BRAND.primary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.actionButtonText, { color: colors.primaryForeground }]}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleVtuConfirmation = async () => {
    if (!utilityType || !gateway || gateway === 'juicyway') {
      setStatus('error');
      setErrorMessage('Utility payment could not be confirmed.');
      return;
    }

    try {
      const result = await waitForVtuConfirmation({
        gateway,
        reference: reference || '',
      });
      setStatus('success');
      setTimeout(() => {
        router.replace({
          pathname: '/utilities/[type]',
          params: {
            type: utilityType,
            paymentStatus: 'successful',
            reference: result.reference,
            amount: String(result.amount ?? Number(amount || 0)),
            ...(customerIdentifier && { customerIdentifier }),
            ...(result.cashback && {
              cashbackAmount: String(result.cashback.amount),
              cashbackNewBalance: String(result.cashback.newBalance),
            }),
          },
        });
      }, 1500);
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Payment confirmation failed.'
      );
    }
  };

  const handleNavigationChange = (navState: WebViewNavigation) => {
    const { url } = navState;

    if (status === 'processing' || status === 'success') {
      return;
    }

    // Paystack/Korapay redirect to /checkout/success?reference=...
    // Crypto checkout redirects to /order-success?type=crypto&orderId=...
    if (
      url.includes('/checkout/success') ||
      url.includes('/order-success') ||
      url.includes('trxref=')
    ) {
      if (paymentKind === 'vtu') {
        setStatus('processing');
        void handleVtuConfirmation();
        return;
      }

      setStatus('success');
      clearCart();
      setTimeout(() => {
        router.replace({
          pathname: '/order-success',
          params: {
            orderId,
            orderNumber: orderNumber || '',
            reference: reference || '',
            paymentMethod: gateway,
          },
        });
      }, 1500);
    }

    // Cancelled
    if (url.includes('cancelled=true') || url.includes('cancel')) {
      setStatus('error');
      setErrorMessage('Payment was cancelled.');
    }
  };

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'crypto_success') {
        setStatus('success');
        clearCart();
        setTimeout(() => {
          router.replace({
            pathname: '/order-success',
            params: {
              orderId: data.orderId || orderId,
              orderNumber: orderNumber || '',
              reference: reference || '',
              paymentMethod: gateway,
            },
          });
        }, 1500);
      }
    } catch {
      // Ignore non-JSON messages
    }
  };

  const handleClose = () => {
    Alert.alert(
      'Cancel Payment?',
      paymentKind === 'vtu'
        ? 'If you leave now, this utility payment may remain incomplete until you retry it.'
        : 'Your order has been created. If you leave, you can complete payment later from your orders page.',
      [
        { text: 'Continue Payment', style: 'cancel' },
        {
          text: 'Leave',
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

  if (status === 'success') {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.statusContainer}>
          <View style={[styles.statusIcon, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={[styles.statusTitle, { color: colors.text }]}>
            Payment Successful!
          </Text>
          <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
            {paymentKind === 'vtu'
              ? 'Redirecting to your utility confirmation...'
              : 'Redirecting to your order confirmation...'}
          </Text>
          <ActivityIndicator
            size="small"
            color={BRAND.primary}
            style={{ marginTop: SPACING.lg }}
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
          <View style={[styles.statusIcon, { backgroundColor: colors.error + '20' }]}>
            <Ionicons name="alert-circle" size={48} color={colors.error} />
          </View>
          <Text style={[styles.statusTitle, { color: colors.text }]}>
            Payment Failed
          </Text>
          <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
            {errorMessage}
          </Text>
          <View style={styles.errorActions}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: BRAND.primary }]}
              onPress={handleRetry}
            >
              <Text style={[styles.actionButtonText, { color: colors.primaryForeground }]}>Try Again</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={() => router.back()}
            >
              <Text
                style={[styles.secondaryButtonText, { color: colors.text }]}
              >
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

      {status === 'loading' && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="large" color={BRAND.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Loading {gatewayName}...
            </Text>
          </View>
        </View>
      )}

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

      <WebView
        ref={webViewRef}
        source={{ uri: authorizationUrl || '' }}
        style={styles.webView}
        onLoadStart={() => setStatus('loading')}
        onLoadEnd={() => setStatus('ready')}
        onNavigationStateChange={handleNavigationChange}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        mixedContentMode="compatibility"
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setStatus('error');
          setErrorMessage(
            nativeEvent.description || 'Failed to load payment page'
          );
        }}
        renderLoading={() => (
          <View style={[styles.webViewLoading, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={BRAND.primary} />
          </View>
        )}
      />

      {amount && (
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
            {'\u20A6'}
            {Number.parseInt(amount, 10).toLocaleString()}
          </Text>
        </View>
      )}
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
  errorActions: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
    width: '100%',
  },
  actionButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
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
    marginBottom: SPACING.lg,
  },
});
