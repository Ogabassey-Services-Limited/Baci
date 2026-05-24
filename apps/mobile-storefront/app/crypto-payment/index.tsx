import Ionicons from "@react-native-vector-icons/ionicons/static";
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { setClipboardString } from '@/lib/clipboard';
import { useCartStore } from '@/stores/cart-store';

const copyToClipboard = async (text: string) => {
  return await setClipboardString(text);
};

const CryptoPaymentParamsSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  orderNumber: z.string().optional(),
  reference: z.string().min(1, 'Reference is required'),
  amount: z.string().min(1, 'Amount is required'),
  address: z.string().min(1, 'Wallet address is required'),
  chain: z.string().min(1, 'Chain is required'),
  currency: z.string().min(1, 'Currency is required'),
  cryptoAmount: z.string().optional(),
  confirmationTime: z.string().optional(),
});

const CHAIN_LABELS: Record<string, string> = {
  TRX: 'Tron (TRC-20)',
  ETH: 'Ethereum (ERC-20)',
  MATIC: 'Polygon',
  AVAXC: 'Avalanche C-Chain',
};

export default function CryptoPaymentScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const params = useLocalSearchParams<Record<string, string>>();
  const clearCart = useCartStore((state) => state.clearCart);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(1800); // 30 minutes

  const validatedParams = (() => {
    const result = CryptoPaymentParamsSchema.safeParse(params);
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
    amount,
    address,
    chain,
    currency,
    cryptoAmount,
    confirmationTime,
  } = validatedParams.data || {};

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleDone = () => {
    clearCart();
    router.replace({
      pathname: '/order-success',
      params: {
        orderId,
        orderNumber: orderNumber || '',
        paymentMethod: 'juicyway',
      },
    });
  };

  const handleClose = () => {
    Alert.alert(
      'Leave Payment?',
      'Your order has been created. You can complete the crypto payment using the wallet address shown. Make sure to copy it before leaving.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  };

  if (!validatedParams.isValid) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={BRAND.primary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Invalid Payment
          </Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {validatedParams.error}
          </Text>
          <Pressable
            style={[styles.actionButton, { backgroundColor: BRAND.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.actionButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const chainLabel = CHAIN_LABELS[chain || ''] || chain || 'Unknown';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <Stack.Screen
        options={{
          title: 'Crypto Payment',
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <View style={styles.content}>
        {/* Timer */}
        <View
          style={[
            styles.timerBadge,
            {
              backgroundColor:
                countdown < 300 ? '#FEE2E2' : `${BRAND.primary}10`,
            },
          ]}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={countdown < 300 ? '#DC2626' : BRAND.primary}
          />
          <Text
            style={[
              styles.timerText,
              { color: countdown < 300 ? '#DC2626' : BRAND.primary },
            ]}
          >
            {countdown > 0
              ? `Payment expires in ${formatTime(countdown)}`
              : 'Payment window expired'}
          </Text>
        </View>

        {/* Amount */}
        <View style={[styles.amountCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            Send exactly
          </Text>
          <Text style={[styles.amountValue, { color: colors.text }]}>
            {cryptoAmount || amount} {currency}
          </Text>
          <Text style={[styles.chainLabel, { color: colors.textSecondary }]}>
            on {chainLabel}
          </Text>
          {amount && (
            <Text style={[styles.fiatAmount, { color: colors.textSecondary }]}>
              {'\u20A6'}
              {Number.parseInt(amount, 10).toLocaleString()} NGN
            </Text>
          )}
        </View>

        {/* Wallet Address */}
        <View style={[styles.addressCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            Wallet Address ({chainLabel})
          </Text>
          <View style={styles.addressRow}>
            <Text
              style={[styles.addressText, { color: colors.text }]}
              selectable
              numberOfLines={2}
            >
              {address}
            </Text>
            <Pressable
              style={[
                styles.copyButton,
                {
                  backgroundColor:
                    copiedField === 'address'
                      ? '#DEF7EC'
                      : `${BRAND.primary}15`,
                },
              ]}
              onPress={() => handleCopy(address || '', 'address')}
            >
              <Ionicons
                name={copiedField === 'address' ? 'checkmark' : 'copy-outline'}
                size={18}
                color={copiedField === 'address' ? '#059669' : BRAND.primary}
              />
            </Pressable>
          </View>
        </View>

        {/* Confirmation Info */}
        {confirmationTime && (
          <View
            style={[styles.infoCard, { backgroundColor: `${BRAND.primary}08` }]}
          >
            <Ionicons
              name="information-circle"
              size={20}
              color={BRAND.primary}
            />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Expected confirmation: {confirmationTime}
            </Text>
          </View>
        )}

        {/* Warning */}
        <View style={[styles.warningCard, { backgroundColor: '#FFF8E1' }]}>
          <Ionicons name="warning" size={20} color="#F59E0B" />
          <View style={styles.warningContent}>
            <Text style={styles.warningText}>
              Only send {currency} on the {chain} network. Sending other tokens
              or using the wrong network will result in permanent loss of funds.
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom Actions */}
      <View
        style={[
          styles.bottomActions,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <Pressable
          style={[styles.actionButton, { backgroundColor: BRAND.primary }]}
          onPress={handleDone}
        >
          <Text style={styles.actionButtonText}>I've Sent the Payment</Text>
        </Pressable>
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
  content: {
    flex: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  amountCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    gap: 4,
  },
  amountLabel: {
    fontSize: 13,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  chainLabel: {
    fontSize: 13,
  },
  fiatAmount: {
    fontSize: 14,
    marginTop: 4,
  },
  addressCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  warningCard: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  warningContent: {
    flex: 1,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  bottomActions: {
    padding: SPACING.lg,
    borderTopWidth: 1,
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
