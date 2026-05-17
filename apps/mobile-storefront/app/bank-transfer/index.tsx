/**
 * Bank Transfer Screen
 * Shows DVA (Dedicated Virtual Account) details for bank transfer payments
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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

const BankTransferParamsSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  orderNumber: z.string().optional(),
  reference: z.string().min(1, 'Reference is required'),
  amount: z.string().min(1, 'Amount is required'),
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  accountName: z.string().min(1, 'Account name is required'),
  trackingToken: z.string().trim().optional(),
});

export default function BankTransferScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const params = useLocalSearchParams<Record<string, string>>();
  const clearCart = useCartStore((state) => state.clearCart);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validatedParams = (() => {
    const result = BankTransferParamsSchema.safeParse(params);
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
    bankName,
    accountNumber,
    accountName,
    trackingToken,
  } = validatedParams.data || {};

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      // Optional: show toast or alert if copy fails
    }
  };

  const handleConfirmTransfer = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    clearCart();
    router.replace({
      pathname: '/order-success',
      params: {
        orderId,
        orderNumber: orderNumber || '',
        paymentMethod: 'bank_transfer',
        ...(trackingToken && { trackingToken }),
      },
    });
  };

  const handleClose = () => {
    Alert.alert(
      'Leave Payment?',
      'Your order has been created. You can complete payment later using the account details sent to your email.',
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
        <View style={styles.centeredContent}>
          <Ionicons name="alert-circle" size={64} color={BRAND.primary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Invalid Transfer Details
          </Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {validatedParams.error}
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: BRAND.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const formattedAmount = Number(amount || '0').toLocaleString();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen
        options={{
          title: 'Bank Transfer',
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <View style={styles.content}>
        <View
          style={[styles.amountCard, { backgroundColor: `${BRAND.primary}10` }]}
        >
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            Transfer exactly
          </Text>
          <Text style={[styles.amountValue, { color: BRAND.primary }]}>
            {'\u20A6'}
            {formattedAmount}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Account Details
        </Text>

        <View
          style={[
            styles.detailsCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <DetailRow
            label="Bank"
            value={bankName || ''}
            colors={colors}
            onCopy={() => handleCopy(bankName || '', 'bank')}
            copied={copiedField === 'bank'}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <DetailRow
            label="Account Number"
            value={accountNumber || ''}
            colors={colors}
            onCopy={() => handleCopy(accountNumber || '', 'account')}
            copied={copiedField === 'account'}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <DetailRow
            label="Account Name"
            value={accountName || ''}
            colors={colors}
            onCopy={() => handleCopy(accountName || '', 'name')}
            copied={copiedField === 'name'}
          />
        </View>

        <View style={styles.instructions}>
          <View style={styles.instructionRow}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.instructionText, { color: colors.textSecondary }]}
            >
              This is a one-time account. Transfer the exact amount shown above.
            </Text>
          </View>
          <View style={styles.instructionRow}>
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.instructionText, { color: colors.textSecondary }]}
            >
              Payment is confirmed automatically once received.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[
            styles.primaryButton,
            {
              backgroundColor: BRAND.primary,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          onPress={handleConfirmTransfer}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Confirm I've sent the money"
          accessibilityState={{ disabled: isSubmitting }}
        >
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? 'Processing...' : "I've Sent the Money"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  colors,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  colors: (typeof Colors)[keyof typeof Colors];
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <View style={detailRowStyles.row}>
      <View style={detailRowStyles.textColumn}>
        <Text style={[detailRowStyles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[detailRowStyles.value, { color: colors.text }]}>
          {value}
        </Text>
      </View>
      <Pressable
        onPress={onCopy}
        style={detailRowStyles.copyButton}
        accessibilityRole="button"
        accessibilityLabel={`Copy ${label.toLowerCase()}`}
        accessibilityHint={copied ? 'Copied to clipboard' : undefined}
      >
        <Ionicons
          name={copied ? 'checkmark' : 'copy-outline'}
          size={20}
          color={copied ? '#059669' : BRAND.primary}
        />
      </Pressable>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  textColumn: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  copyButton: {
    padding: SPACING.sm,
  },
});

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
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  amountCard: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xl,
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  detailsCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  divider: {
    height: 1,
  },
  instructions: {
    gap: SPACING.sm,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    padding: SPACING.lg,
  },
  primaryButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
